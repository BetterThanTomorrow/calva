import * as vscode from 'vscode';
import * as paredit from "./paredit/extension";
import * as fmt from "./calva-fmt/src/extension";
import * as highlight from "./highlight/src/extension";
import * as state from './state';
import * as jackIn from './nrepl/jack-in';
import * as util from './utilities'
import status from './status';
import connector from './connector';
import CalvaCompletionItemProvider from './providers/completion';
import TextDocumentContentProvider from './providers/content';
import HoverProvider from './providers/hover';
import * as definition from './providers/definition';
import { CalvaSignatureHelpProvider } from './providers/signature';
import testRunner from './testRunner';
import annotations from './providers/annotations';
import select from './select';
import eval from "./evaluate"
import refresh from "./refresh";
import * as greetings from "./greet";
import Analytics from './analytics';
import * as open from 'open';
import statusbar from './statusbar';
import * as debug from './debugger/calva-debug';
import * as model from './cursor-doc/model';
import { LanguageClient, RequestType, ServerOptions, LanguageClientOptions } from 'vscode-languageclient';
import * as path from 'path';
import * as outputWindow from './results-output/results-doc';
import * as replHistory from './results-output/repl-history';
import config from './config';
import handleNewCljFiles from './fileHandler';

let clojureLanguageClient: LanguageClient;

async function onDidSave(document) {
    let {
        evaluate,
        test,
    } = state.config();

    if (document.languageId !== 'clojure') {
        return;
    }

    if (test && util.getConnectedState()) {
        testRunner.runNamespaceTests(document);
        state.analytics().logEvent("Calva", "OnSaveTest").send();
    } else if (evaluate) {
        if (!outputWindow.isResultsDoc(document)) {
            await eval.loadFile(document, state.config().prettyPrintingOptions);
            outputWindow.appendPrompt();
            state.analytics().logEvent("Calva", "OnSaveLoad").send();
        }
    }
}

function onDidOpen(document) {
    if (document.languageId !== 'clojure') {
        return;
    }
}

function activateLSP(context: vscode.ExtensionContext) {
    const jarPath = path.join(context.extensionPath, 'clojure-lsp.jar');
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
            "dependency-scheme": "jar"
        }
    };

    clojureLanguageClient = new LanguageClient(
        'clojureLSP',
        'Clojure Language Client',
        serverOptions,
        clientOptions
    );

    context.subscriptions.push(clojureLanguageClient.start());

    const jarEventEmitter: vscode.EventEmitter<vscode.Uri> = new vscode.EventEmitter();
    const contentsRequest = new RequestType<string, string, string, vscode.CancellationToken>('clojure/dependencyContents');
    const provider = {
        onDidChange: jarEventEmitter.event,
        provideTextDocumentContent: async (uri: vscode.Uri, token: vscode.CancellationToken): Promise<string> => {
            const v = await clojureLanguageClient.sendRequest<any, string, string, vscode.CancellationToken>(contentsRequest,
                { uri: decodeURIComponent(uri.toString()) },
                token);
            return v || '';
        }
    };
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('jar', provider));
    console.log('clojure-lsp started');
}

function setKeybindingsEnabledContext() {
    let keybindingsEnabled = vscode.workspace.getConfiguration().get(config.KEYBINDINGS_ENABLED_CONFIG_KEY);
    vscode.commands.executeCommand('setContext', config.KEYBINDINGS_ENABLED_CONTEXT_KEY, keybindingsEnabled);
}

function activate(context: vscode.ExtensionContext) {
    activateLSP(context);
    state.cursor.set('analytics', new Analytics(context));
    state.analytics().logPath("/start").logEvent("LifeCycle", "Started").send();

    model.initScanner(vscode.workspace.getConfiguration('editor').get('maxTokenizationLineLength'));

    const chan = state.outputChannel();

    const legacyExtension = vscode.extensions.getExtension('cospaia.clojure4vscode');
    const fmtExtension = vscode.extensions.getExtension('cospaia.calva-fmt');
    const pareEditExtension = vscode.extensions.getExtension('cospaia.paredit-revived');
    const cwExtension = vscode.extensions.getExtension('tonsky.clojure-warrior');
    const vimExtension = vscode.extensions.getExtension('vscodevim.vim');
    const cwConfig = vscode.workspace.getConfiguration('clojureWarrior');
    const customCljsRepl = state.config().customCljsRepl;
    const replConnectSequences = state.config().replConnectSequences;
    const BUTTON_GOTO_DOC = "Open the docs";
    const BUTTON_OK = "Got it";
    const VIM_DOC_URL = "https://calva.io/vim/";
    const VIEWED_VIM_DOCS = "viewedVimDocs";
    const CONNECT_SEQUENCES_DOC_URL = "https://calva.io/connect-sequences/";

    if (customCljsRepl && replConnectSequences.length == 0) {
        chan.appendLine("Old customCljsRepl settings detected.");
        vscode.window.showErrorMessage("Old customCljsRepl settings detected. You need to specify it using the new calva.customConnectSequence setting. See the Calva user documentation for instructions.", ...[BUTTON_GOTO_DOC, BUTTON_OK])
            .then(v => {
                if (v == BUTTON_GOTO_DOC) {
                    open(CONNECT_SEQUENCES_DOC_URL).catch(() => { });
                }
            })
    }

    if (legacyExtension) {
        vscode.window.showErrorMessage("Calva Legacy extension detected. Things will break. Please uninstall, or disable, the old Calva extension.", ...["Roger that. Right away!"])
    }

    state.setExtensionContext(context);

    if (!fmtExtension) {
        try {
            fmt.activate(context);
        } catch (e) {
            console.error("Failed activating Formatter: " + e.message)
        }
    } else {
        vscode.window.showErrorMessage("Calva Format extension detected, which will break things. Please uninstall or, disable, it before continuing using Calva.", ...["Got it. Will do!"]);
    }
    if (!pareEditExtension) {
        try {
            paredit.activate(context);
        } catch (e) {
            console.error("Failed activating Paredit: " + e.message)
        }
    } else {
        vscode.window.showErrorMessage("Calva Paredit extension detected, which will cause problems. Please uninstall, or disable, it.", ...["I hear ya. Doing it!"]);
    }

    chan.appendLine("Calva activated.");
    if (state.config().openCalvaSaysOnStart) {
        chan.show(true);
    }
    status.update();

    // COMMANDS
    context.subscriptions.push(vscode.commands.registerCommand('calva.jackInOrConnect', jackIn.calvaJackInOrConnect));
    context.subscriptions.push(vscode.commands.registerCommand('calva.jackIn', jackIn.calvaJackIn))
    context.subscriptions.push(vscode.commands.registerCommand('calva.connectNonProjectREPL', connector.connectNonProjectREPLCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.connect', connector.connectCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.disconnect', jackIn.calvaDisconnect));
    context.subscriptions.push(vscode.commands.registerCommand('calva.toggleCLJCSession', connector.toggleCLJCSession));
    context.subscriptions.push(vscode.commands.registerCommand('calva.switchCljsBuild', connector.switchCljsBuild));
    context.subscriptions.push(vscode.commands.registerCommand('calva.selectCurrentForm', select.selectCurrentForm));
    context.subscriptions.push(vscode.commands.registerCommand('calva.loadFile', async () => {
        await eval.loadFile({}, state.config().prettyPrintingOptions);
        outputWindow.appendPrompt();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('calva.interruptAllEvaluations', eval.interruptAllEvaluations));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateSelection', eval.evaluateCurrentForm));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateUser', eval.evaluateUser));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateCurrentTopLevelForm', eval.evaluateTopLevelForm));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateSelectionReplace', eval.evaluateSelectionReplace));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateSelectionAsComment', eval.evaluateSelectionAsComment));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateTopLevelFormAsComment', eval.evaluateTopLevelFormAsComment));
    context.subscriptions.push(vscode.commands.registerCommand('calva.togglePrettyPrint', eval.togglePrettyPrint));
    context.subscriptions.push(vscode.commands.registerCommand('calva.runTestUnderCursor', testRunner.runTestUnderCursorCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.runNamespaceTests', testRunner.runNamespaceTestsCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.runAllTests', testRunner.runAllTestsCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.rerunTests', testRunner.rerunTestsCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.clearInlineResults', annotations.clearEvaluationDecorations));
    context.subscriptions.push(vscode.commands.registerCommand('calva.copyLastResults', eval.copyLastResultCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.requireREPLUtilities', eval.requireREPLUtilitiesCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.refresh', refresh.refresh));
    context.subscriptions.push(vscode.commands.registerCommand('calva.refreshAll', refresh.refreshAll));
    context.subscriptions.push(vscode.commands.registerCommand('calva.debug.instrument', eval.instrumentTopLevelForm));
    context.subscriptions.push(vscode.commands.registerCommand('calva.runCustomREPLCommand', async () => {
        await eval.evaluateCustomCommandSnippetCommand();
        outputWindow.appendPrompt();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('calva.showOutputWindow', () => { outputWindow.revealResultsDoc(false) }));
    context.subscriptions.push(vscode.commands.registerCommand('calva.setOutputWindowNamespace', outputWindow.setNamespaceFromCurrentFile));
    context.subscriptions.push(vscode.commands.registerCommand('calva.sendCurrentFormToOutputWindow', outputWindow.appendCurrentForm));
    context.subscriptions.push(vscode.commands.registerCommand('calva.sendCurrentTopLevelFormToOutputWindow', outputWindow.appendCurrentTopLevelForm));
    context.subscriptions.push(vscode.commands.registerCommand('calva.showPreviousReplHistoryEntry', replHistory.showPreviousReplHistoryEntry));
    context.subscriptions.push(vscode.commands.registerCommand('calva.showNextReplHistoryEntry', replHistory.showNextReplHistoryEntry));
    context.subscriptions.push(vscode.commands.registerCommand('calva.clearReplHistory', replHistory.clearHistory));
    context.subscriptions.push(vscode.commands.registerCommand('calva.toggleKeybindingsEnabled', () => {
        let keybindingsEnabled = vscode.workspace.getConfiguration().get(config.KEYBINDINGS_ENABLED_CONFIG_KEY);
        vscode.workspace.getConfiguration().update(config.KEYBINDINGS_ENABLED_CONFIG_KEY, !keybindingsEnabled, vscode.ConfigurationTarget.Global);
    }));
    // The title of this command is dictated by clojure-lsp and is executed when the user clicks the references code lens above a symbol
    context.subscriptions.push(vscode.commands.registerCommand('code-lens-references', async (params) => {
        const selectionLine = vscode.window.activeTextEditor.selection.start.line;
        // const contentsRequest = new RequestType<string, string, string, vscode.CancellationToken>('clojure/dependencyContents');
        // const references = await clojureLanguageClient.sendRequest<any, string, string, vscode.CancellationToken>(contentsRequest,
        //     { uri: decodeURIComponent(uri.toString()) },
        //     token);
        const references = await clojureLanguageClient.sendRequest('textDocument/references', 
            { 
                textDocument: { uri: "file:///home/brandon/development/clojure-test/src/core.clj"},
                position: {
                    line: 63,
                    character: 12
                },
                context: {
                    includeDeclaration: true
                }
            });
        console.log('selectionLine', selectionLine);
    }));

    // Temporary command to teach new default keyboard shortcut chording key
    context.subscriptions.push(vscode.commands.registerCommand('calva.tellAboutNewChordingKey', () => {
        vscode.window.showInformationMessage(`The ”Calva key” has changed. It is now: ctrl+alt+c`);
    }));

    // Initial set of the provided contexts
    outputWindow.setContextForOutputWindowActive(false);
    vscode.commands.executeCommand("setContext", "calva:launching", false);
    vscode.commands.executeCommand("setContext", "calva:connected", false);
    vscode.commands.executeCommand("setContext", "calva:connecting", false);
    setKeybindingsEnabledContext();

    // PROVIDERS
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(state.documentSelector, new CalvaCompletionItemProvider()));
    context.subscriptions.push(vscode.languages.registerHoverProvider(state.documentSelector, new HoverProvider()));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(state.documentSelector, new definition.ClojureDefinitionProvider()));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(state.documentSelector, new definition.StackTraceDefinitionProvider()));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(state.documentSelector, new definition.ResultsDefinitionProvider()));
    context.subscriptions.push(vscode.languages.registerSignatureHelpProvider(state.documentSelector, new CalvaSignatureHelpProvider(), ' ', ' '));


    vscode.workspace.registerTextDocumentContentProvider('jar', new TextDocumentContentProvider());

    // //EVENTS
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument((document) => {
        onDidOpen(document);
    }));
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document) => {
        onDidSave(document);
    }));
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
        status.update();
        replHistory.setReplHistoryCommandsActiveContext(editor);
    }));
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(annotations.onDidChangeTextDocument));
    context.subscriptions.push(new vscode.Disposable(() => {
        connector.disconnect();
        chan.dispose();
    }));

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((_: vscode.ConfigurationChangeEvent) => {
        statusbar.update();
    }));
    context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(event => {
        replHistory.setReplHistoryCommandsActiveContext(event.textEditor);
    }));
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(document => {
        if (outputWindow.isResultsDoc(document)) {
            outputWindow.setContextForOutputWindowActive(false);
        }
    }));
    context.subscriptions.push(vscode.window.onDidChangeVisibleTextEditors(editors => {
        if (!editors.some(editor => outputWindow.isResultsDoc(editor.document))) {
            outputWindow.setContextForOutputWindowActive(false);
        }
    }));
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => {
        if (e.affectsConfiguration(config.KEYBINDINGS_ENABLED_CONFIG_KEY)) {
            setKeybindingsEnabledContext();
        }
    }));
    context.subscriptions.push(vscode.workspace.onDidCreateFiles(handleNewCljFiles));

    // Clojure debug adapter setup
    const provider = new debug.CalvaDebugConfigurationProvider();
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider(debug.CALVA_DEBUG_CONFIGURATION.type, provider));
    const factory = new debug.CalvaDebugAdapterDescriptorFactory();
    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory(debug.CALVA_DEBUG_CONFIGURATION.type, factory));
    if ('dispose' in factory) {
        context.subscriptions.push(factory);
    }

    vscode.commands.executeCommand('setContext', 'calva:activated', true);

    greetings.activationGreetings(chan);

    if (vimExtension) {
        chan.appendLine(`VIM Extension detected. Please read: ${VIM_DOC_URL} now and then.\n`);
        if (!context.globalState.get(VIEWED_VIM_DOCS)) {
            vscode.window.showErrorMessage("VIM Extension detected. Please view the docs for tips (and to stop this info box from appearing).", ...[BUTTON_GOTO_DOC])
                .then(v => {
                    if (v == BUTTON_GOTO_DOC) {
                        context.globalState.update(VIEWED_VIM_DOCS, true);
                        open(VIM_DOC_URL).catch(() => { });
                    }
                })
        }
    }

    state.analytics().logPath("/activated").logEvent("LifeCycle", "Activated").send();

    if (!cwExtension) {
        try {
            highlight.activate(context);
        } catch (e) {
            console.error("Failed activating Highlight: " + e.message)
        }
    } else {
        vscode.window.showErrorMessage("Clojure Warrior extension detected. This will not work well together with Calva's highlighting (which is an improvement on Clojure Warrior). Please uninstall ut before continuing to use Calva.", ...["Got it.", "Will do!"]);
    }

    for (const config of ["enableBracketColors", "bracketColors", "cycleBracketColors", "misplacedBracketStyle", "matchedBracketStyle", "commentFormStyle", "ignoredFormStyle"]) {
        if (cwConfig.get(config) !== undefined) {
            vscode.window.showWarningMessage("Legacy Clojure Warrior settings detected. These settings have changed prefix/namespace to from `clojureWarrior´ to `calva.highlight`. You should update `settings.json`.", ...["Roger that!"]);
            break;
        }
    }

    return {
        hasParedit: true,
        hasFormatter: true
    }
}

function deactivate() {
    state.analytics().logEvent("LifeCycle", "Deactivated").send();
    jackIn.calvaJackout();
    paredit.deactivate()
    if (clojureLanguageClient) {
        return clojureLanguageClient.stop();
    }
}

export { activate, deactivate };
