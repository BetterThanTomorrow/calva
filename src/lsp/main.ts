import * as vscode from 'vscode';
import { LanguageClient, ServerOptions, LanguageClientOptions, DocumentSymbol, Position } from 'vscode-languageclient';
import * as util from '../utilities'
import * as config from '../config';
import { provideClojureDefinition } from '../providers/definition';
import { setStateValue, getStateValue } from '../../out/cljs-lib/cljs-lib';
import { downloadClojureLsp } from './download';
import { readVersionFile, getClojureLspPath } from './utilities';

const LSP_CLIENT_KEY = 'lspClient';

function createClient(clojureLspPath: string): LanguageClient {
    const serverOptions: ServerOptions = {
        run: { command: clojureLspPath },
        debug: { command: clojureLspPath },
    };
    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'clojure' }],
        synchronize: {
            configurationSection: 'clojure-lsp',
            fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
        },
        initializationOptions: {
            "dependency-scheme": "jar",
            "auto-add-ns-to-new-files?": true,
            "document-formatting?": false,
            "document-range-formatting?": false,
            "keep-require-at-start?": true,
        },
        middleware: {
            handleDiagnostics(uri, diagnostics, next) {
                if (uri.path.endsWith(config.REPL_FILE_EXT)) {
                    return;
                }
                return next(uri, diagnostics);
            },
            provideCodeActions(document, range, context, token, next) {
                return next(document, range, context, token);
            },
            provideCodeLenses: async (document, token, next): Promise<vscode.CodeLens[]> => {
                if (config.getConfig().referencesCodeLensEnabled) {
                    return await next(document, token);
                }
                return [];
            },
            resolveCodeLens: async (codeLens, token, next) => {
                if (config.getConfig().referencesCodeLensEnabled) {
                    return await next(codeLens, token);
                }
                return null;
            },
            provideHover(document, position, token, next) {
                if (util.getConnectedState()) {
                    return null;
                } else {
                    return next(document, position, token);
                }
            },
            async provideDefinition(document, position, token, next) {
                const nReplDefinition = await provideClojureDefinition(document, position, token);
                if (nReplDefinition) {
                    return null;
                } else {
                    return next(document, position, token);
                }
            },
            provideCompletionItem(document, position, context, token, next) {
                if (util.getConnectedState()) {
                    return null;
                } else {
                    return next(document, position, context, token);
                }
            },
            provideSignatureHelp(document, position, context, token, next) {
                if (util.getConnectedState()) {
                    return null;
                } else {
                    return next(document, position, context, token);
                }
            }
        }
    };
    return new LanguageClient(
        'clojure',
        'Clojure Language Client',
        serverOptions,
        clientOptions
    );
}

type ExtraParamFn = () => Thenable<string>;

type ClojureLspCommand = {
    command: string,
    extraParamFns?: ExtraParamFn[],
    category?: string;
}

function makePromptForInput(placeHolder: string) {
    return async () => {
        return await vscode.window.showInputBox({
            value: '',
            placeHolder: placeHolder,
            validateInput: (input => input.trim() === '' ? 'Empty input' : null)
        })
    }
}

const clojureLspCommands: ClojureLspCommand[] = [
    {
        command: 'clean-ns'
    },
    {
        command: 'add-missing-libspec'
    },
    // This seems to be similar to Calva's rewrap commands
    //{
    //    command: 'cycle-coll'
    //},
    {
        command: 'cycle-privacy'
    },
    {
        command: 'expand-let'
    },
    {
        command: 'thread-first'
    },
    {
        command: 'thread-first-all'
    },
    {
        command: 'thread-last'
    },
    {
        command: 'thread-last-all'
    },
    {
        command: 'inline-symbol'
    },
    {
        command: 'unwind-all'
    },
    {
        command: 'unwind-thread'
    },
    {
        command: 'introduce-let',
        extraParamFns: [makePromptForInput('Bind to')]
    },
    {
        command: 'move-to-let',
        extraParamFns: [makePromptForInput('Bind to')]
    },
    {
        command: 'extract-function',
        extraParamFns: [makePromptForInput('Function name')]
    },
    {
        command: 'server-info',
        category: 'calva.diagnostics'
    }
];

function sendCommandRequest(client: LanguageClient, command: string, args: (number | string)[]): void {
    client.sendRequest('workspace/executeCommand', {
        command,
        arguments: args
    }).catch(e => {
        console.error(e);
    });
}

function registerLspCommand(client: LanguageClient, command: ClojureLspCommand): vscode.Disposable {
    const category = command.category ? command.category : 'calva.refactor';
    const vscodeCommand = `${category}.${command.command.replace(/-[a-z]/g, (m) => m.substring(1).toUpperCase())}`;
    return vscode.commands.registerCommand(vscodeCommand, async () => {
        const editor = vscode.window.activeTextEditor;
        const document = util.getDocument(editor.document);
        if (document && document.languageId === 'clojure') {
            const line = editor.selection.start.line;
            const column = editor.selection.start.character;
            const docUri = `${document.uri.scheme}://${document.uri.path}`;
            const params = [docUri, line, column];
            const extraParams = command.extraParamFns ? await Promise.all(command.extraParamFns.map(fn => fn())) : [];
            sendCommandRequest(client, command.command, [...params, ...extraParams]);
        }
    });
}

async function codeLensReferencesHandler(_, line, character): Promise<void> {
    vscode.window.activeTextEditor.selection = new vscode.Selection(line - 1, character - 1, line - 1, character - 1);
    await vscode.commands.executeCommand('editor.action.referenceSearch.trigger');
}

function registerCommands(context: vscode.ExtensionContext, client: LanguageClient) {
    // The title of this command is dictated by clojure-lsp and is executed when the user clicks the references code lens above a symbol
    context.subscriptions.push(vscode.commands.registerCommand('code-lens-references', codeLensReferencesHandler));

    const resolveMacroAsCommand = 'resolve-macro-as';
    context.subscriptions.push(vscode.commands.registerCommand(resolveMacroAsCommand, async (document, line, character) => {
        const macroToResolveAs = await vscode.window.showQuickPick([
            'clojure.core/def',
            'clojure.core/defn',
            'clojure.core/let',
            'clojure.core/for',
            'clojure.core/->',
            'clojure.core/->>',
            'clj-kondo.lint-as/def-catch-all'
        ]);
        const rootWorkspaceFolder = vscode.workspace.workspaceFolders[0];
        // TODO: Make config paths that work on windows
        const configPaths = ['~/.clj-kondo/config.edn'];
        if (rootWorkspaceFolder) {
            configPaths.push(`${rootWorkspaceFolder.uri.fsPath}/.clj-kondo/config.edn`);
        }
        // TODO: Add description / title to quickpick via options
        const cljKondoConfigPath = await vscode.window.showQuickPick(configPaths);
        if (macroToResolveAs && cljKondoConfigPath) {
            const args = [document, line, character, macroToResolveAs, cljKondoConfigPath];
            sendCommandRequest(client, resolveMacroAsCommand, args);
        }
    }));

    context.subscriptions.push(
        ...clojureLspCommands.map(command => registerLspCommand(client, command))
    );
}

function registerEventHandlers(context: vscode.ExtensionContext, client: LanguageClient) {
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async event => {
        if (event.affectsConfiguration('calva.referencesCodeLens.enabled')) {
            const visibleFileEditors = vscode.window.visibleTextEditors.filter(editor => {
                return editor.document.uri.scheme === 'file';
            });

            for (let editor of visibleFileEditors) {
                // Hacky solution for triggering codeLens refresh
                // Could not find a better way, aside from possibly changes to clojure-lsp
                // https://github.com/microsoft/vscode-languageserver-node/issues/705
                const edit1 = new vscode.WorkspaceEdit();
                edit1.insert(editor.document.uri, new vscode.Position(0, 0), '\n');
                await vscode.workspace.applyEdit(edit1);
                const edit2 = new vscode.WorkspaceEdit();
                edit2.delete(editor.document.uri, new vscode.Range(0, 0, 1, 0));
                await vscode.workspace.applyEdit(edit2);
            }
        }
    }));
}

async function startClient(clojureLspPath: string, context: vscode.ExtensionContext): Promise<void> {
    const client = createClient(clojureLspPath);
    console.log('Starting clojure-lsp at', clojureLspPath);
    const onReadyPromise = client.onReady();
    vscode.window.setStatusBarMessage('$(sync~spin) Initializing Clojure language features via clojure-lsp', onReadyPromise);
    client.start();
    await onReadyPromise;
    setStateValue(LSP_CLIENT_KEY, client);
    registerCommands(context, client);
    registerEventHandlers(context, client);
}

async function activate(context: vscode.ExtensionContext): Promise<void> {
    const extensionPath = context.extensionPath;
    const currentVersion = readVersionFile(extensionPath);
    let clojureLspPath = getClojureLspPath(extensionPath, util.isWindows);
    const configuredVersion: string = config.getConfig().clojureLspVersion;
    if (currentVersion !== configuredVersion) {
        const downloadPromise = downloadClojureLsp(context.extensionPath, configuredVersion);
        vscode.window.setStatusBarMessage('$(sync~spin) Downloading clojure-lsp', downloadPromise);
        clojureLspPath = await downloadPromise;
    }
    await startClient(clojureLspPath, context);
}

function deactivate(): Promise<void> {
    const client = getStateValue(LSP_CLIENT_KEY);
    if (client) {
        return client.stop();
    }
    return Promise.resolve();
}

async function getReferences(lspClient: LanguageClient, uri: string, position: Position, includeDeclaration: boolean = true): Promise<Location[] | null> {
    const result: Location[] = await lspClient.sendRequest('textDocument/references', {
        textDocument: {
            uri,
        },
        position,
        context: {
            includeDeclaration
        }
    });
    return result;
}

async function getDocumentSymbols(lspClient: LanguageClient, uri: string): Promise<DocumentSymbol[]> {
    const result: DocumentSymbol[] = await lspClient.sendRequest('textDocument/documentSymbol', {
        textDocument: {
            uri
        }
    });
    return result;
}

export default {
    activate,
    deactivate,
    LSP_CLIENT_KEY,
    getReferences,
    getDocumentSymbols
}