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
import { DefinitionProvider } from './providers/definition';
import { CalvaSignatureHelpProvider } from './providers/signature';
import evaluator from './evaluate';
import testRunner from './testRunner';
import annotations from './providers/annotations';
import select from './select';
import evaluate from "./evaluate"
import refresh from "./refresh";
import * as replWindow from "./repl-window";
import * as greetings from "./greet";
import Analytics from './analytics';
import * as open from 'open';
import statusbar from './statusbar';
import { CalvaDebugConfigurationProvider, CalvaDebugAdapterDescriptorFactory, CALVA_DEBUG_CONFIGURATION } from './debugger/calva-debug';
import * as model from './cursor-doc/model';

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
        evaluator.loadFile(document, undefined, state.config().prettyPrintingOptions).catch(() => {});
        state.analytics().logEvent("Calva", "OnSaveLoad").send();
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

    const legacyExtension = vscode.extensions.getExtension('cospaia.clojure4vscode'),
        fmtExtension = vscode.extensions.getExtension('cospaia.calva-fmt'),
        pareEditExtension = vscode.extensions.getExtension('cospaia.paredit-revived'),
        cwExtension = vscode.extensions.getExtension('tonsky.clojure-warrior'),
        vimExtension = vscode.extensions.getExtension('vscodevim.vim'),
        cwConfig = vscode.workspace.getConfiguration('clojureWarrior'),
        customCljsRepl = state.config().customCljsRepl,
        replConnectSequences = state.config().replConnectSequences,
        BUTTON_GOTO_DOC = "Open the docs",
        BUTTON_OK = "Got it",
        VIM_DOC_URL = "https://calva.io/vim/",
        VIEWED_VIM_DOCS = "viewedVimDocs",
        CONNECT_SEQUENCES_DOC_URL = "https://calva.io/connect-sequences/"

    if (customCljsRepl && replConnectSequences.length == 0) {
        chan.appendLine("Old customCljsRepl settings detected.");
        vscode.window.showErrorMessage("Old customCljsRepl settings detected. You need to specify it using the new calva.customConnectSequence setting. See the Calva user documentation for instructions.", ...[BUTTON_GOTO_DOC, BUTTON_OK])
            .then(v => {
                if (v == BUTTON_GOTO_DOC) {
                    open(CONNECT_SEQUENCES_DOC_URL).catch(() => {});
                }
            })
    }

    if (legacyExtension) {
        vscode.window.showErrorMessage("Calva Legacy extension detected. Things will break. Please uninstall, or disable, the old Calva extension.", ...["Roger that. Right away!"])
    }

    state.setExtensionContext(context);

    if (!fmtExtension) {
        fmt.activate(context);
    } else {
        vscode.window.showErrorMessage("Calva Format extension detected, which will break things. Please uninstall or, disable, it before continuing using Calva.", ...["Got it. Will do!"]);
    }
    if (!pareEditExtension) {
        paredit.activate(context);
    } else {
        vscode.window.showErrorMessage("Calva Paredit extension detected, which can cause pronlems. Please uninstall, or disable, it.", ...["I hear ya. Doing it!"]);
    }

    replWindow.activate(context);

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
        evaluator.loadFile({}, undefined, state.config().prettyPrintingOptions).then((resolved) => {
            chan.show(true);
        }).catch((reason) => {
            chan.show(true);
        });
    }));
    context.subscriptions.push(vscode.commands.registerCommand('calva.interruptAllEvaluations', evaluator.interruptAllEvaluations));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateSelection', evaluator.evaluateCurrentForm));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateCurrentTopLevelForm', evaluator.evaluateTopLevelForm));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateSelectionReplace', evaluator.evaluateSelectionReplace));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateSelectionAsComment', evaluator.evaluateSelectionAsComment));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateTopLevelFormAsComment', evaluator.evaluateTopLevelFormAsComment));
    context.subscriptions.push(vscode.commands.registerCommand('calva.togglePrettyPrint', evaluator.togglePrettyPrint));
    context.subscriptions.push(vscode.commands.registerCommand('calva.runTestUnderCursor', testRunner.runTestUnderCursorCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.runNamespaceTests', testRunner.runNamespaceTestsCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.runAllTests', testRunner.runAllTestsCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.rerunTests', testRunner.rerunTestsCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.clearInlineResults', annotations.clearEvaluationDecorations));
    context.subscriptions.push(vscode.commands.registerCommand('calva.copyAnnotationHoverText', annotations.copyHoverTextCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.copyLastResults', evaluate.copyLastResultCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.requireREPLUtilities', evaluate.requireREPLUtilitiesCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.refresh', refresh.refresh));
    context.subscriptions.push(vscode.commands.registerCommand('calva.refreshAll', refresh.refreshAll));
    context.subscriptions.push(vscode.commands.registerCommand('debug.instrument', evaluator.instrumentTopLevelForm));

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
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(state.documentSelector, new DefinitionProvider()));
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
        if (editor && editor.document && editor.document.fileName) {
            const fileExtIfClj = editor.document.fileName.match(/\.clj[cs]?/);
            if (fileExtIfClj && fileExtIfClj.length && state.config().syncReplNamespaceToCurrentFile) {
                replWindow.setREPLNamespace(util.getDocumentNamespace(editor.document))
                    .catch(reasons => { console.warn(`Namespace sync failed, because: ${reasons}`) });
            }
        }
    }));
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(annotations.onDidChangeTextDocument))
    context.subscriptions.push(new vscode.Disposable(() => {
        connector.disconnect();
        chan.dispose();
    }));

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((_: vscode.ConfigurationChangeEvent) => {
        statusbar.update();
    }));

    // Clojure debug adapter setup
    const provider = new CalvaDebugConfigurationProvider();
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider(CALVA_DEBUG_CONFIGURATION.type, provider));
    const factory = new CalvaDebugAdapterDescriptorFactory();
    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory(CALVA_DEBUG_CONFIGURATION.type, factory));
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
        highlight.activate(context);
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
    state.analytics().logEvent("LifeCycle", "Dectivated").send();
    jackIn.calvaJackout();
    paredit.deactivate()
}

export { activate, deactivate };
