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
import * as replWindow from "./repl-window";
import * as greetings from "./greet";
import Analytics from './analytics';
import * as open from 'open';
import statusbar from './statusbar';
import * as debug from './debugger/calva-debug';
import * as model from './cursor-doc/model';
import * as outputWindow from './result-output'

function onDidSave(document) {
    let {
        evaluate,
        test,
        prettyPrintingOptions
    } = state.config();

    if (document.languageId !== 'clojure') {
        return;
    }

    if (test) {
        if (test) {
            testRunner.runNamespaceTests(document);
            state.analytics().logEvent("Calva", "OnSaveTest").send();
        }
    } else if (evaluate) {
        if (!outputWindow.isResultsDoc(document)) {
            eval.loadFile(document, undefined, state.config().prettyPrintingOptions).catch(() => {});
            state.analytics().logEvent("Calva", "OnSaveLoad").send();
        }
    }
}

function onDidOpen(document) {
    if (document.languageId !== 'clojure') {
        return;
    }
}


function activate(context: vscode.ExtensionContext) {
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

    try {
        replWindow.activate(context);
    } catch (e) {
        console.error("Failed activating REPL Window: " + e.message)
    }


    chan.appendLine("Calva activated.");

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
    context.subscriptions.push(vscode.commands.registerCommand('calva.loadFile', () => {
        eval.loadFile({}, undefined, state.config().prettyPrintingOptions);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('calva.interruptAllEvaluations', eval.interruptAllEvaluations));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateSelection', eval.evaluateCurrentForm));
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

    context.subscriptions.push(vscode.commands.registerCommand('calva.showOutputWindow', () => { outputWindow.revealResultsDoc(false) }));

    // Temporary command to teach new default keyboard shortcut chording key
    context.subscriptions.push(vscode.commands.registerCommand('calva.tellAboutNewChordingKey', () => {
        vscode.window.showInformationMessage(`The ”Calva key” has changed. It is now: ctrl+alt+c`);
    }));

    // Initial set of the provided contexts
    vscode.commands.executeCommand("setContext", "calva:replWindowActive", false);
    vscode.commands.executeCommand("setContext", "calva:launching", false);
    vscode.commands.executeCommand("setContext", "calva:connected", false);
    vscode.commands.executeCommand("setContext", "calva:connecting", false);

    // PROVIDERS
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(state.documentSelector, new CalvaCompletionItemProvider()));
    context.subscriptions.push(vscode.languages.registerHoverProvider(state.documentSelector, new HoverProvider()));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(state.documentSelector, new definition.ClojureDefinitionProvider()));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(state.documentSelector, new definition.PathDefinitionProvider()));
    context.subscriptions.push(vscode.languages.registerSignatureHelpProvider(state.documentSelector, new CalvaSignatureHelpProvider(),  ' ', ' '));


    vscode.workspace.registerTextDocumentContentProvider('jar', new TextDocumentContentProvider());

    // //EVENTS
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument((document) => {
        onDidOpen(document);
    }));
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document) => {
        onDidSave(document);
    }));
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
        vscode.commands.executeCommand("setContext", "calva:replWindowActive", false);
        status.update();
        const editorNamespace = util.getDocumentNamespace(editor.document);
        if (editor && editor.document && editor.document.fileName) {
            const fileExtIfClj = editor.document.fileName.match(/\.clj[cs]?/);
            if (fileExtIfClj && fileExtIfClj.length && state.config().syncReplNamespaceToCurrentFile) {
                replWindow.setREPLNamespace(editorNamespace)
                    .catch(reasons => { console.warn(`Namespace sync failed, because: ${reasons}`) });
            }
        }
    }));
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(annotations.onDidChangeTextDocument));
    context.subscriptions.push(new vscode.Disposable(() => {
        connector.disconnect();
        chan.dispose();
    }));

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((_: vscode.ConfigurationChangeEvent) => {
        statusbar.update();
    }));

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
            vscode.window.showErrorMessage("VIM Extension detected. There be dragons. Please view the docs for tips (and to stop this info box from appearing).", ...[BUTTON_GOTO_DOC])
                .then(v => {
                    if (v == BUTTON_GOTO_DOC) {
                        context.globalState.update(VIEWED_VIM_DOCS, true);
                        open(VIM_DOC_URL).catch(() => {});
                    }
                })
        }
    }

    chan.appendLine("Start the REPL with the command *Start Project REPL and connect (aka Jack-in)*.")
    chan.appendLine("Default keybinding for Jack-in: ctrl+alt+c ctrl+alt+j");
    state.analytics().logPath("/activated").logEvent("LifeCycle", "Activated").send();

    if (!cwExtension) {
        try {
            highlight.activate(context);
        } catch (e) {
            console.error("Failed activating Highlight: " + e.message)
        }
    } else {
        vscode.window.showErrorMessage("Clojure Warrior extension detected. Please uninstall it before continuing to use Calva.", ...["Got it.", "Will do!"]);
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
}

export { activate, deactivate };
