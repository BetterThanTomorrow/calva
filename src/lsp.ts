import * as vscode from 'vscode';
import { LanguageClient, ServerOptions, LanguageClientOptions, DocumentSymbol, Position } from 'vscode-languageclient';
import * as path from 'path';
import * as state from './state';
import * as util from './utilities'
import config from './config';
import { provideClojureDefinition } from './providers/definition';
import { setStateValue } from '../out/cljs-lib/cljs-lib';

const LSP_CLIENT_KEY = 'lspClient';

function createClient(jarPath: string): LanguageClient {
    const serverOptions: ServerOptions = {
        run: { command: 'java', args: ['-jar', jarPath] },
        debug: { command: 'java', args: ['-jar', jarPath] },
    };
    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'clojure' }],
        synchronize: {
            configurationSection: 'clojure-lsp',
            fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
        },
        initializationOptions: {
            "dependency-scheme": "jar",
            // LSP-TODO: Use lsp's feature and remove Calva's feature for this 
            "auto-add-ns-to-new-files?": false,
            "document-formatting?": false,
            "document-range-formatting?": false,
            "keep-require-at-start?": true,
        },
        middleware: {
            handleDiagnostics(uri, diagnostics, next) {
                if (!state.config().displayDiagnostics) {
                    return next(uri, []);
                }
                if (uri.path.endsWith(config.REPL_FILE_EXT)) {
                    return;
                }
                return next(uri, diagnostics);
            },
            provideCodeActions(document, range, context, token, next) {
                return next(document, range, context, token);
            },
            provideCodeLenses: async (document, token, next): Promise<vscode.CodeLens[]> => {
                if (state.config().referencesCodeLensEnabled) {
                    return await next(document, token);
                }
                return [];
            },
            resolveCodeLens: async (codeLens, token, next) => {
                if (state.config().referencesCodeLensEnabled) {
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

type ClojureLspCommand = {
    command: string,
    extraParamFn?: () => Thenable<string>,
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
        extraParamFn: makePromptForInput('Bind to')
    },
    {
        command: 'move-to-let',
        extraParamFn: makePromptForInput('Bind to')
    },
    {
        command: 'extract-function',
        extraParamFn: makePromptForInput('Function name')
    },
    {
        command: 'server-info',
        category: 'calva.diagnostics'
    }
]

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
            const extraParam = command.extraParamFn ? await command.extraParamFn() : undefined;
            if (!command.extraParamFn || command.extraParamFn && extraParam) {
                client.sendRequest('workspace/executeCommand', {
                    'command': command.command,
                    'arguments': extraParam ? [...params, extraParam] : params
                }).catch(e => {
                    console.error(e);
                });
            }
        }
    });
}

function registerCommands(context: vscode.ExtensionContext, client: LanguageClient) {
    // The title of this command is dictated by clojure-lsp and is executed when the user clicks the references code lens above a symbol
    context.subscriptions.push(vscode.commands.registerCommand('code-lens-references', async (_, line, character) => {
        vscode.window.activeTextEditor.selection = new vscode.Selection(line - 1, character - 1, line - 1, character - 1);
        await vscode.commands.executeCommand('editor.action.referenceSearch.trigger');
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

async function activate(context: vscode.ExtensionContext): Promise<void> {
    const jarPath = path.join(context.extensionPath, 'clojure-lsp.jar');
    const client = createClient(jarPath);

    registerCommands(context, client);
    registerEventHandlers(context, client);

    vscode.window.setStatusBarMessage('$(sync~spin) Initializing Clojure language features via clojure-lsp', client.onReady());

    client.start();
    await client.onReady();
    setStateValue(LSP_CLIENT_KEY, client);
}

function deactivate(): Promise<void> {
    const client = state.deref().get(LSP_CLIENT_KEY);
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