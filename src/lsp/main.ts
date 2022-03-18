import * as vscode from 'vscode';
import {
    LanguageClient,
    ServerOptions,
    LanguageClientOptions,
    DocumentSymbol,
    Position,
    StaticFeature,
    ClientCapabilities,
    ServerCapabilities,
    DocumentSelector,
    MessageType,
} from 'vscode-languageclient/node';
import * as util from '../utilities';
import * as config from '../config';
import { provideClojureDefinition } from '../providers/definition';
import { provideCompletionItems } from '../providers/completion';
import { setStateValue, getStateValue } from '../../out/cljs-lib/cljs-lib';
import { downloadClojureLsp, getLatestVersion } from './download';
import { readVersionFile, getClojureLspPath } from './utilities';
import { TestTreeHandler, TestTreeParams } from './types';
import * as os from 'os';
import * as path from 'path';
import * as state from '../state';
import { provideHover } from '../providers/hover';
import { provideSignatureHelp } from '../providers/signature';
import { isResultsDoc } from '../results-output/results-doc';
import { MessageItem } from 'vscode';

const LSP_CLIENT_KEY = 'lspClient';
const LSP_CLIENT_KEY_ERROR = 'lspClientError';
const RESOLVE_MACRO_AS_COMMAND = 'resolve-macro-as';
const SERVER_NOT_RUNNING_OR_INITIALIZED_MESSAGE =
    'The clojure-lsp server is not running or has not finished initializing.';
const lspStatus = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    0
);
let serverVersion: string;
let extensionContext: vscode.ExtensionContext;
let clojureLspPath: string;
let testTreeHandler: TestTreeHandler;
let lspCommandsRegistered = false;

// The Node LSP client requires the client code to jump through a few hoops in
// order to enable an experimental feature. This class exists solely to set
// enable the `experimental.testTree` feature.
class TestTreeFeature implements StaticFeature {
    initialize(
        capabilities: ServerCapabilities,
        documentSelector: DocumentSelector | undefined
    ): void {
        // do nothing
    }

    fillClientCapabilities(capabilities: ClientCapabilities): void {
        capabilities.experimental = { testTree: true };
    }

    dispose(): void {
        // do nothing
    }
}

function createClient(clojureLspPath: string): LanguageClient {
    const serverOptions: ServerOptions = {
        run: { command: clojureLspPath },
        debug: { command: clojureLspPath },
    };
    const clientOptions: LanguageClientOptions = {
        documentSelector: [
            { scheme: 'file', language: 'clojure' },
            { scheme: 'jar', language: 'clojure' },
        ],
        synchronize: {
            configurationSection: 'clojure-lsp',
            fileEvents:
                vscode.workspace.createFileSystemWatcher('**/.clientrc'),
        },
        progressOnInitialization: true,
        initializationOptions: {
            'dependency-scheme': 'jar',
            'auto-add-ns-to-new-files?': true,
            'document-formatting?': false,
            'document-range-formatting?': false,
            'keep-require-at-start?': true,
        },
        middleware: {
            didOpen: (document, next) => {
                if (isResultsDoc(document)) {
                    return;
                }
                return next(document);
            },
            didSave: (document, next) => {
                if (isResultsDoc(document)) {
                    return;
                }
                return next(document);
            },
            didChange: (change, next) => {
                if (isResultsDoc(change.document)) {
                    return;
                }
                return next(change);
            },
            provideLinkedEditingRange: (
                _document,
                _position,
                _token,
                _next
            ): null => {
                return null;
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
            provideCodeLenses: async (
                document,
                token,
                next
            ): Promise<vscode.CodeLens[]> => {
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
                let hover: vscode.Hover;
                try {
                    hover = await provideHover(document, position);
                } catch {
                    // continue regardless of error
                }

                if (hover) {
                    return null;
                } else {
                    return next(document, position, token);
                }
            },
            async provideDefinition(document, position, token, next) {
                const definition = await provideClojureDefinition(
                    document,
                    position,
                    token
                );
                if (definition) {
                    return null;
                } else {
                    return next(document, position, token);
                }
            },
            async provideCompletionItem(
                document,
                position,
                context,
                token,
                next
            ) {
                const items = await provideCompletionItems(
                    document,
                    position,
                    token,
                    context
                );
                if (items) {
                    return null;
                } else {
                    return next(document, position, context, token);
                }
            },
            async provideSignatureHelp(
                document,
                position,
                context,
                token,
                next
            ) {
                const help = await provideSignatureHelp(
                    document,
                    position,
                    token
                );
                if (help) {
                    return null;
                } else {
                    return next(document, position, context, token);
                }
            },
        },
    };
    return new LanguageClient(
        'clojure',
        'Clojure Language Client',
        serverOptions,
        clientOptions
    );
}

type ClojureLspCommand = {
    command: string;
    extraParamFn?: () => Thenable<string>;
    category?: string;
};

function makePromptForInput(placeHolder: string) {
    return async () => {
        return await vscode.window.showInputBox({
            value: '',
            placeHolder: placeHolder,
            validateInput: (input) =>
                input.trim() === '' ? 'Empty input' : null,
        });
    };
}

const clojureLspCommands: ClojureLspCommand[] = [
    {
        command: 'clean-ns',
    },
    {
        command: 'add-missing-libspec',
    },
    // This seems to be similar to Calva's rewrap commands
    //{
    //    command: 'cycle-coll'
    //},
    {
        command: 'cycle-privacy',
    },
    {
        command: 'expand-let',
    },
    {
        command: 'thread-first',
    },
    {
        command: 'thread-first-all',
    },
    {
        command: 'thread-last',
    },
    {
        command: 'thread-last-all',
    },
    {
        command: 'inline-symbol',
    },
    {
        command: 'unwind-all',
    },
    {
        command: 'unwind-thread',
    },
    {
        command: 'introduce-let',
        extraParamFn: makePromptForInput('Bind to'),
    },
    {
        command: 'move-to-let',
        extraParamFn: makePromptForInput('Bind to'),
    },
    {
        command: 'extract-function',
        extraParamFn: makePromptForInput('Function name'),
    },
];

function sendCommandRequest(command: string, args: (number | string)[]): void {
    const client = getStateValue(LSP_CLIENT_KEY);
    if (client) {
        client
            .sendRequest('workspace/executeCommand', {
                command,
                arguments: args,
            })
            .catch((e) => {
                console.error(e);
            });
    }
}

function registerLspCommand(command: ClojureLspCommand): vscode.Disposable {
    const category = command.category ? command.category : 'calva.refactor';
    const vscodeCommand = `${category}.${command.command.replace(
        /-[a-z]/g,
        (m) => m.substring(1).toUpperCase()
    )}`;
    return vscode.commands.registerCommand(vscodeCommand, async () => {
        const editor = util.getActiveTextEditor();
        const document = util.tryToGetDocument(editor.document);
        if (document && document.languageId === 'clojure') {
            const line = editor.selection.start.line;
            const column = editor.selection.start.character;
            const docUri = `${document.uri.scheme}://${document.uri.path}`;
            const params = [docUri, line, column];
            const extraParam = command.extraParamFn
                ? await command.extraParamFn()
                : undefined;
            if (!command.extraParamFn || (command.extraParamFn && extraParam)) {
                sendCommandRequest(
                    command.command,
                    extraParam ? [...params, extraParam] : params
                );
            }
        }
    });
}

async function codeLensReferencesHandler(_, line, character): Promise<void> {
    util.getActiveTextEditor().selection = new vscode.Selection(
        line - 1,
        character - 1,
        line - 1,
        character - 1
    );
    await vscode.commands.executeCommand(
        'editor.action.referenceSearch.trigger'
    );
}

function resolveMacroAsCommandHandler(): void {
    const activeTextEditor = util.tryToGetActiveTextEditor();
    if (activeTextEditor?.document?.languageId === 'clojure') {
        const documentUri = decodeURIComponent(
            activeTextEditor.document.uri.toString()
        );
        const { line, character } = activeTextEditor.selection.active;
        sendCommandRequest(RESOLVE_MACRO_AS_COMMAND, [
            documentUri,
            line + 1,
            character + 1,
        ]);
    }
}

const generalCommands = [
    {
        // The title of this command is dictated by clojure-lsp and is executed when the user clicks the references code lens for a symbol
        name: 'code-lens-references',
        handler: codeLensReferencesHandler,
    },
    {
        name: 'calva.linting.resolveMacroAs',
        handler: resolveMacroAsCommandHandler,
    },
];

function registerLspCommands(context: vscode.ExtensionContext) {
    if (!lspCommandsRegistered) {
        context.subscriptions.push(
            ...generalCommands.map((command) =>
                vscode.commands.registerCommand(command.name, command.handler)
            )
        );
        context.subscriptions.push(
            ...clojureLspCommands.map((command) => registerLspCommand(command))
        );
    }
    lspCommandsRegistered = true;
}

function registerEventHandlers(
    context: vscode.ExtensionContext,
    client: LanguageClient
) {
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async (event) => {
            if (
                event.affectsConfiguration('calva.referencesCodeLens.enabled')
            ) {
                const visibleFileEditors =
                    vscode.window.visibleTextEditors.filter((editor) => {
                        return editor.document.uri.scheme === 'file';
                    });

                for (const editor of visibleFileEditors) {
                    // Hacky solution for triggering codeLens refresh
                    // Could not find a better way, aside from possibly changes to clojure-lsp
                    // https://github.com/microsoft/vscode-languageserver-node/issues/705
                    const edit1 = new vscode.WorkspaceEdit();
                    edit1.insert(
                        editor.document.uri,
                        new vscode.Position(0, 0),
                        '\n'
                    );
                    await vscode.workspace.applyEdit(edit1);
                    const edit2 = new vscode.WorkspaceEdit();
                    edit2.delete(
                        editor.document.uri,
                        new vscode.Range(0, 0, 1, 0)
                    );
                    await vscode.workspace.applyEdit(edit2);
                }
            }
        })
    );
}

function stopClient() {
    const client = getStateValue(LSP_CLIENT_KEY);
    void vscode.commands.executeCommand(
        'setContext',
        'clojureLsp:active',
        false
    );
    updateStatusItem('stopped');
    setStateValue(LSP_CLIENT_KEY, undefined);
    if (client) {
        console.log('Stopping clojure-lsp');
        return client.stop();
    }
}

async function startClientCommand() {
    lspStatus.show();
    await maybeDownloadLspServer();
    await startClient();
}

async function startClient(): Promise<void> {
    const client = createClient(clojureLspPath);
    console.log('Starting clojure-lsp at', clojureLspPath);

    const testTree: StaticFeature = new TestTreeFeature();
    client.registerFeature(testTree);

    const onReadyPromise = client.onReady();
    updateStatusItem('starting');

    client.start();
    await onReadyPromise.catch((e) => {
        console.error('clojure-lsp:', e);
        setStateValue(LSP_CLIENT_KEY_ERROR, e);
    });
    if (getStateValue(LSP_CLIENT_KEY_ERROR)) {
        return;
    }
    setStateValue(LSP_CLIENT_KEY, client);
    registerLspCommands(extensionContext);
    registerEventHandlers(extensionContext, client);
    const serverInfo = await getServerInfo(client);
    serverVersion = serverInfo['server-version'];
    sayClientVersionInfo(serverVersion, serverInfo);
    await vscode.commands.executeCommand(
        'setContext',
        'clojureLsp:active',
        true
    );
    updateStatusItem('started');

    client.onNotification(
        'clojure/textDocument/testTree',
        (tree: TestTreeParams) => {
            testTreeHandler(tree);
        }
    );

    client.onRequest('window/showMessageRequest', (params) => {
        // showInformationMessage can't handle some of the menus that clojure-lsp uses
        // https://github.com/BetterThanTomorrow/calva/issues/1539
        // We count the sum of the lengths of the button titles and
        // use a QuickPick menu when it exceeds some number
        const totalActionsLength = params.actions.reduce(
            (length: number, action: MessageItem) =>
                (length += action.title.length),
            0
        );
        if (params.type === MessageType.Info && totalActionsLength > 25) {
            return quickPick(params.message, params.actions);
        }
        // Else we use this, copied from the default client
        // TODO: Can we reuse the default clients implementation?
        let messageFunc: <T extends MessageItem>(
            message: string,
            ...items: T[]
        ) => Thenable<T>;
        switch (params.type) {
            case MessageType.Error:
                messageFunc = vscode.window.showErrorMessage;
                break;
            case MessageType.Warning:
                messageFunc = vscode.window.showWarningMessage;
                break;
            case MessageType.Info:
                messageFunc = vscode.window.showInformationMessage;
                break;
            default:
                messageFunc = vscode.window.showInformationMessage;
        }
        const actions = params.actions || [];
        return messageFunc(params.message, ...actions);
    });
}

// A quickPick that expects the same input as showInformationMessage does
// TODO: How do we make it satisfy the messageFunc interface above?
function quickPick(
    message: string,
    actions: { title: string }[]
): Promise<{ title: string }> {
    const qp = vscode.window.createQuickPick();
    qp.items = actions.map((item) => ({ label: item.title }));
    qp.title = message;
    return new Promise<{ title: string }>((resolve, _reject) => {
        qp.show();
        qp.onDidAccept(() => {
            if (qp.selectedItems.length > 0) {
                resolve({
                    title: qp.selectedItems[0].label,
                });
            } else {
                resolve(undefined);
            }
            qp.hide();
        });
        qp.onDidHide(() => {
            resolve(undefined);
            qp.hide();
        });
    });
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
        void vscode.window.showInformationMessage(
            SERVER_NOT_RUNNING_OR_INITIALIZED_MESSAGE
        );
    }
}

function registerLifeCycleCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'calva.clojureLsp.start',
            startClientCommand
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('calva.clojureLsp.stop', stopClient)
    );
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'calva.clojureLsp.download',
            downloadLSPServerCommand
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'calva.clojureLsp.showClojureLspStoppedMenu',
            stoppedMenuCommand
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'calva.clojureLsp.showClojureLspStartedMenu',
            startedMenuCommand
        )
    );
}

function registerDiagnosticsCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'calva.diagnostics.clojureLspServerInfo',
            serverInfoCommandHandler
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'calva.diagnostics.openClojureLspLogFile',
            openLogFile
        )
    );
}

type LspStatus =
    | 'preparing'
    | 'stopped'
    | 'starting'
    | 'started'
    | 'downloading';

function updateStatusItem(status: LspStatus, extraInfo?: string) {
    switch (status) {
        case 'preparing':
            lspStatus.text = '$(dash) clojure-lsp';
            lspStatus.tooltip = 'Calva is preparing to initialize Clojure-LSP';
            lspStatus.command = undefined;
            break;
        case 'stopped':
            lspStatus.text = '$(circle-outline) clojure-lsp';
            lspStatus.tooltip =
                'Clojure-LSP is not active, click to get a menu';
            lspStatus.command = 'calva.clojureLsp.showClojureLspStoppedMenu';
            break;
        case 'starting':
            lspStatus.text = '$(rocket) clojure-lsp';
            lspStatus.tooltip = 'Clojure-LSP is starting';
            lspStatus.command = undefined;
            break;
        case 'started':
            lspStatus.text = '$(circle-filled) clojure-lsp';
            lspStatus.tooltip = 'Clojure-LSP is active';
            lspStatus.command = 'calva.clojureLsp.showClojureLspStartedMenu';
            break;
        case 'downloading':
            lspStatus.text = '$(sync~spin) clojure-lsp downloading';
            lspStatus.tooltip = `Calva is downloading clojure-lsp version: ${extraInfo}`;
            lspStatus.command = undefined;
            break;
        default:
            break;
    }
}

async function activate(
    context: vscode.ExtensionContext,
    handler: TestTreeHandler
): Promise<void> {
    await vscode.commands.executeCommand(
        'setContext',
        'clojureLsp:active',
        false
    );
    extensionContext = context;
    testTreeHandler = handler;
    registerLifeCycleCommands(context);
    registerDiagnosticsCommands(context);
    updateStatusItem('preparing');
    if (config.getConfig().enableClojureLspOnStart) {
        lspStatus.show();
        await maybeDownloadLspServer();
        await startClient();
    } else {
        updateStatusItem('stopped');
    }
}

async function maybeDownloadLspServer(forceDownLoad = false): Promise<string> {
    const userConfiguredClojureLspPath = config.getConfig().clojureLspPath;
    if (userConfiguredClojureLspPath !== '') {
        clojureLspPath = userConfiguredClojureLspPath;
        if (forceDownLoad) {
            void vscode.window.showErrorMessage(
                `Not downloading, because 'calva.clojureLSPPath' is configured (${userConfiguredClojureLspPath})`
            );
        }
        return undefined;
    } else {
        return await ensureServerDownloaded(forceDownLoad);
    }
}

async function downloadLSPServerCommand() {
    lspStatus.show();
    const version = await maybeDownloadLspServer(true);
    void vscode.window.showInformationMessage(
        `Downloaded clojure-lsp version: ${version}`
    );
}

async function ensureServerDownloaded(forceDownLoad = false): Promise<string> {
    const currentVersion = readVersionFile(extensionContext.extensionPath);
    const configuredVersion: string = config.getConfig().clojureLspVersion;
    clojureLspPath = getClojureLspPath(
        extensionContext.extensionPath,
        util.isWindows
    );
    const downloadVersion = ['', 'latest'].includes(configuredVersion)
        ? await getLatestVersion()
        : configuredVersion;
    if (
        (currentVersion !== downloadVersion && downloadVersion !== '') ||
        forceDownLoad ||
        !util.pathExists(clojureLspPath)
    ) {
        const downloadPromise = downloadClojureLsp(
            extensionContext.extensionPath,
            downloadVersion
        );
        updateStatusItem('downloading', downloadVersion);
        await downloadPromise;
        updateStatusItem('stopped');
    }
    return readVersionFile(extensionContext.extensionPath);
}

function deactivate(): Promise<void> {
    return stopClient();
}

async function getReferences(
    lspClient: LanguageClient,
    uri: string,
    position: Position,
    includeDeclaration: boolean = true
): Promise<Location[] | null> {
    const result: Location[] = await lspClient.sendRequest(
        'textDocument/references',
        {
            textDocument: {
                uri,
            },
            position,
            context: {
                includeDeclaration,
            },
        }
    );
    return result;
}

async function getDocumentSymbols(
    lspClient: LanguageClient,
    uri: string
): Promise<DocumentSymbol[]> {
    const result: DocumentSymbol[] = await lspClient.sendRequest(
        'textDocument/documentSymbol',
        {
            textDocument: {
                uri,
            },
        }
    );
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
        void vscode.window.showTextDocument(vscode.Uri.file(logPath));
    } else {
        void vscode.window.showInformationMessage(
            SERVER_NOT_RUNNING_OR_INITIALIZED_MESSAGE
        );
    }
}

export async function getClojuredocs(
    symName: string,
    symNs: string
): Promise<any> {
    if (serverVersion > '2021.10.20-16.49.47') {
        const client: LanguageClient = getStateValue(LSP_CLIENT_KEY);
        return client.sendRequest('clojure/clojuredocs/raw', {
            symName,
            symNs,
        });
    } else {
        return null;
    }
}

// TODO: This feels a bit brute, what are other ways to wait for the client to initialize?
function getClient(timeout: number): Promise<LanguageClient> | undefined {
    const start = Date.now();
    return new Promise(waitForClientStarted);

    function waitForClientStarted(resolve, reject) {
        if (getStateValue(LSP_CLIENT_KEY)) {
            resolve(getStateValue(LSP_CLIENT_KEY));
        } else if (getStateValue(LSP_CLIENT_KEY_ERROR)) {
            reject(
                new Error('clojure-lsp: ' + getStateValue(LSP_CLIENT_KEY_ERROR))
            );
        } else if (Date.now() - start >= timeout) {
            reject(new Error('clojure-lsp: timeout'));
        } else {
            setTimeout(waitForClientStarted.bind(this, resolve, reject), 30);
        }
    }
}

export async function getCljFmtConfig() {
    // TODO: Figure out a reasonable timeout
    const client = await getClient(60 * 5 * 1000).catch((e) => {
        console.error(
            `Formatting: Error waiting for clojure-lsp to start: ${e}`
        );
    });
    if (client) {
        const serverInfo = await getServerInfo(client);
        return serverInfo['cljfmt-raw'];
    }
}

function showMenu(
    items: vscode.QuickPickItem[],
    commands: Record<string, string>
) {
    void vscode.window
        .showQuickPick(items, { title: 'clojure-lsp' })
        .then((v) => {
            if (commands[v.label]) {
                void vscode.commands.executeCommand(commands[v.label]);
            }
        });
}

function stoppedMenuCommand() {
    const START_OPTION = 'Start';
    const START_COMMAND = 'calva.clojureLsp.start';
    const DOWNLOAD_OPTION = 'Download configured version';
    const DOWNLOAD_COMMAND = 'calva.clojureLsp.download';
    const commands = {};
    commands[START_OPTION] = START_COMMAND;
    commands[DOWNLOAD_OPTION] = DOWNLOAD_COMMAND;
    const items: vscode.QuickPickItem[] = [
        {
            label: START_OPTION,
            description: 'Start the clojure-lsp server',
        },
        {
            label: DOWNLOAD_OPTION,
            description: `${config.getConfig().clojureLspVersion}`,
        },
    ];
    showMenu(items, commands);
}

function startedMenuCommand() {
    const STOP_OPTION = 'Stop';
    const STOP_COMMAND = 'calva.clojureLsp.stop';
    const INFO_OPTION = 'Show server info';
    const INFO_COMMAND = 'calva.diagnostics.clojureLspServerInfo';
    const LOG_OPTION = 'Open log';
    const LOG_COMMAND = 'calva.diagnostics.openClojureLspLogFile';
    const commands = {};
    commands[STOP_OPTION] = STOP_COMMAND;
    commands[INFO_OPTION] = INFO_COMMAND;
    commands[LOG_OPTION] = LOG_COMMAND;
    const items: vscode.QuickPickItem[] = [
        {
            label: INFO_OPTION,
            description: 'Print clojure-lsp server info to `Calva says`',
        },
        {
            label: LOG_OPTION,
            description: 'Open the clojure-lsp log file',
        },
        {
            label: STOP_OPTION,
            description: 'Stop the clojure-lsp server',
        },
    ];
    showMenu(items, commands);
}

export default {
    activate,
    deactivate,
    LSP_CLIENT_KEY,
    getReferences,
    getDocumentSymbols,
};
