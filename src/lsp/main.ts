import * as vscode from 'vscode';
import { LanguageClient, ServerOptions, LanguageClientOptions, DocumentSymbol, Position } from 'vscode-languageclient/node';
import * as util from '../utilities'
import * as config from '../config';
import { provideClojureDefinition } from '../providers/definition';
import { provideCompletionItems } from '../providers/completion';
import { setStateValue, getStateValue } from '../../out/cljs-lib/cljs-lib';
import { downloadClojureLsp, getLatestVersion } from './download';
import { readVersionFile, getClojureLspPath } from './utilities';
import * as os from 'os';
import * as path from 'path';
import * as state from '../state';
import { provideHover } from '../providers/hover';
import { provideSignatureHelp } from '../providers/signature';
import { ProviderResult, CodeAction } from 'vscode';

const LSP_CLIENT_KEY = 'lspClient';
const RESOLVE_MACRO_AS_COMMAND = 'resolve-macro-as';
const SERVER_NOT_RUNNING_OR_INITIALIZED_MESSAGE = 'The clojure-lsp server is not running or has not finished intializing.'
const lspStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, -1);
let serverVersion: string;

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
            provideLinkedEditingRange: async (_document, _position, _token, _next): Promise<vscode.LinkedEditingRanges> => {
                return null;
            },
            async resolveCodeAction(item, token, next): Promise<CodeAction> {
                const { command } = await next(item, token);
                if (command) {
                    sendCommandRequest(command.command, command.arguments);
                    return null;
                }
                return next(item, token);
            },
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
            async provideHover(document, position, token, next) {
                const hover: vscode.Hover = await provideHover(document, position);
                if (hover) {
                    return null;
                } else {
                    return next(document, position, token);
                }
            },
            async provideDefinition(document, position, token, next) {
                const definition = await provideClojureDefinition(document, position, token);
                if (definition) {
                    return null;
                } else {
                    return next(document, position, token);
                }
            },
            async provideCompletionItem(document, position, context, token, next) {
                const items = await provideCompletionItems(document, position, token, context);
                if (items) {
                    return null;
                } else {
                    return next(document, position, context, token);
                }
            },
            async provideSignatureHelp(document, position, context, token, next) {
                const help = await provideSignatureHelp(document, position, token);
                if (help) {
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
    }
];

function sendCommandRequest(command: string, args: (number | string)[]): void {
    const client = getStateValue(LSP_CLIENT_KEY);
    if (client) {
        client.sendRequest('workspace/executeCommand', {
            command,
            arguments: args
        }).catch(e => {
            console.error(e);
        });
    }
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
            const extraParam = command.extraParamFn ? await command.extraParamFn() : undefined;
            if (!command.extraParamFn || command.extraParamFn && extraParam) {
                sendCommandRequest(command.command, (extraParam ? [...params, extraParam] : params));
            }
        }
    });
}

async function codeLensReferencesHandler(_, line, character): Promise<void> {
    vscode.window.activeTextEditor.selection = new vscode.Selection(line - 1, character - 1, line - 1, character - 1);
    await vscode.commands.executeCommand('editor.action.referenceSearch.trigger');
}


async function resolveMacroAsCodeActionCommandHandler(document: string, line: number, character: number): Promise<void> {
    const macroToResolveAs = await vscode.window.showQuickPick([
        'clojure.core/def',
        'clojure.core/defn',
        'clojure.core/let',
        'clojure.core/for',
        'clojure.core/->',
        'clojure.core/->>',
        'clj-kondo.lint-as/def-catch-all'
    ]);
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const rootWorkspaceFolder = workspaceFolders && workspaceFolders[0];
    const homeDirectory = os.homedir();
    const cljKondoUserConfig = path.join(homeDirectory, '.config', 'clj-kondo', 'config.edn');
    const configPaths = [cljKondoUserConfig];
    if (rootWorkspaceFolder) {
        const cljKondoProjectConfig = path.join(rootWorkspaceFolder.uri.fsPath, '.clj-kondo', 'config.edn');
        configPaths.push(cljKondoProjectConfig);
    }
    const cljKondoConfigPath = await vscode.window.showQuickPick(configPaths, { placeHolder: 'Select where this setting should be saved:' });
    if (macroToResolveAs && cljKondoConfigPath) {
        const args = [document, line, character, macroToResolveAs, cljKondoConfigPath];
        sendCommandRequest(RESOLVE_MACRO_AS_COMMAND, args);
    }
}

function resolveMacroAsCommandHandler(): void {
    const activeTextEditor = vscode.window.activeTextEditor;
    if (activeTextEditor && activeTextEditor.document && activeTextEditor.document.languageId === 'clojure') {
        const documentUri = decodeURIComponent(activeTextEditor.document.uri.toString());
        const { line, character } = activeTextEditor.selection.active;
        resolveMacroAsCodeActionCommandHandler(documentUri, line + 1, character + 1);
    }
}

const generalCommands = [
    {
        // The title of this command is dictated by clojure-lsp and is executed when the user clicks the references code lens for a symbol
        name: 'code-lens-references',
        handler: codeLensReferencesHandler
    },
    {
        // The title of this command is dictated by clojure-lsp and is executed when the user executes the Resolve Macro As code action
        name: RESOLVE_MACRO_AS_COMMAND,
        handler: resolveMacroAsCodeActionCommandHandler
    },
    {
        name: 'calva.linting.resolveMacro',
        handler: resolveMacroAsCommandHandler
    }
];

function registerCommands(context: vscode.ExtensionContext, client: LanguageClient) {
    context.subscriptions.push(
        ...generalCommands.map(command => vscode.commands.registerCommand(command.name, command.handler))
    );
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
    lspStatus.text = '$(sync~spin) Initializing Clojure language features via clojure-lsp';
    lspStatus.show();
    client.start();
    await onReadyPromise;
    lspStatus.hide();
    setStateValue(LSP_CLIENT_KEY, client);
    registerCommands(context, client);
    registerEventHandlers(context, client);
    const serverInfo = await getServerInfo(client);
    serverVersion = serverInfo['server-version'];
    sayClientVersionInfo(serverVersion, serverInfo);
}

function sayClientVersionInfo(serverVersion: string, serverInfo: any) {
    const cljKondoVersion = serverInfo['clj-kondo-version'];
    const calvaSaysChannel = state.outputChannel();
    calvaSaysChannel.appendLine('');
    calvaSaysChannel.appendLine(`clojure-lsp version used: ${serverVersion}`);
    calvaSaysChannel.appendLine(`clj-kondo version used: ${cljKondoVersion}`);
}

async function serverInfoCommandHandler(): Promise<void> {
    const client = getStateValue(LSP_CLIENT_KEY);
    if (client) {
        const serverInfo = await getServerInfo(client);
        const calvaSaysChannel = state.outputChannel();
        calvaSaysChannel.appendLine(`Clojure-lsp server info:`);
        const serverInfoPretty = JSON.stringify(serverInfo, null, 2);
        calvaSaysChannel.appendLine(serverInfoPretty);
        calvaSaysChannel.show(true);
    } else {
        vscode.window.showInformationMessage(SERVER_NOT_RUNNING_OR_INITIALIZED_MESSAGE);
    }
}

function registerDiagnosticsCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(vscode.commands.registerCommand('calva.diagnostics.clojureLspServerInfo', serverInfoCommandHandler));
    context.subscriptions.push(vscode.commands.registerCommand('calva.diagnostics.openClojureLspLogFile', openLogFile));
}

async function activate(context: vscode.ExtensionContext): Promise<void> {
    registerDiagnosticsCommands(context);
    const extensionPath = context.extensionPath;
    const currentVersion = readVersionFile(extensionPath);
    const userConfiguredClojureLspPath = config.getConfig().clojureLspPath;
    let clojureLspPath = userConfiguredClojureLspPath === '' ? getClojureLspPath(extensionPath, util.isWindows) : userConfiguredClojureLspPath;
    if (userConfiguredClojureLspPath === '') {
        const configuredVersion: string = config.getConfig().clojureLspVersion;
        const downloadVersion = ['', 'latest'].includes(configuredVersion) ? await getLatestVersion() : configuredVersion;
        if (currentVersion !== downloadVersion) {
            const downloadPromise = downloadClojureLsp(context.extensionPath, downloadVersion);
            lspStatus.text = '$(sync~spin) Downloading clojure-lsp';
            lspStatus.show();
            clojureLspPath = await downloadPromise;
            lspStatus.hide();
        }
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

async function getServerInfo(lspClient: LanguageClient): Promise<any> {
    return lspClient.sendRequest('clojure/serverInfo/raw');
}

async function openLogFile(): Promise<void> {
    const client = getStateValue(LSP_CLIENT_KEY);
    if (client) {
        const serverInfo = await getServerInfo(client);
        const logPath = serverInfo['log-path'];
        vscode.window.showTextDocument(vscode.Uri.file(logPath));
    } else {
        vscode.window.showInformationMessage(SERVER_NOT_RUNNING_OR_INITIALIZED_MESSAGE);
    }
}

export async function getClojuredocs(symName: string, symNs: string): Promise<any> {
    if (serverVersion > '2021.10.20-16.49.47') {
        const client: LanguageClient = getStateValue(LSP_CLIENT_KEY);
        return client.sendRequest('clojure/clojuredocs/raw', {
            symName,
            symNs
        });
    } else {
        return null;
    }
}

export default {
    activate,
    deactivate,
    LSP_CLIENT_KEY,
    getReferences,
    getDocumentSymbols
}
