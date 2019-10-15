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
import EvaluateMiddleWare from './evaluate';
import LintMiddleWare from './lint';
import TestRunnerMiddleWare from './testRunner';
import annotations from './providers/annotations';
import select from './select';
import evaluate from "./evaluate"
import refresh from "./refresh";
import * as replWindow from "./repl-window";
import * as greetings from "./greet";
import Analytics from './analytics';
import * as open from 'open';
import statusbar from './statusbar';

function onDidSave(document) {
    let {
        evaluate,
        lint,
        test
    } = state.config();

    if (document.languageId !== 'clojure') {
        return;
    }

    if (test) {
        if (test) {
            TestRunnerMiddleWare.runNamespaceTests(document);
            state.analytics().logEvent("Calva", "OnSaveTest").send();
        }
    } else if (evaluate) {
        EvaluateMiddleWare.loadFile(document);
        state.analytics().logEvent("Calva", "OnSaveLoad").send();
    }
    if (lint) {
        LintMiddleWare.lintDocument(document);
        state.analytics().logEvent("Calva", "OnSaveLint").send();
    }
}

function onDidOpen(document) {
    if (document.languageId !== 'clojure') {
        return;
    }

    if (state.config().lint) {
        LintMiddleWare.lintDocument(document);
    }
}


function activate(context: vscode.ExtensionContext) {
    state.cursor.set('analytics', new Analytics(context));
    state.analytics().logPath("/start").logEvent("LifeCycle", "Started").send();

    const chan = state.outputChannel();

    const legacyExtension = vscode.extensions.getExtension('cospaia.clojure4vscode'),
        fmtExtension = vscode.extensions.getExtension('cospaia.calva-fmt'),
        pareEditExtension = vscode.extensions.getExtension('cospaia.paredit-revived'),
        cwExtension = vscode.extensions.getExtension('tonsky.clojure-warrior'),
        cwConfig = vscode.workspace.getConfiguration('clojureWarrior'),
        customCljsRepl = state.config().customCljsRepl,
        replConnectSequences = state.config().replConnectSequences,
        BUTTON_GOTO_DOC = "Open the docs",
        BUTTON_OK = "Got it",
        DOC_URL = "https://calva.readthedocs.io/en/latest/connect-sequences.html";

    if (customCljsRepl && replConnectSequences.length == 0) {
        chan.appendLine("Old customCljsRepl settings detected.");
        vscode.window.showErrorMessage("Old customCljsRepl settings detected. You need to specify it using the new calva.customConnectSequence setting. See the Calva user documentation for instructions.", ...[BUTTON_GOTO_DOC, BUTTON_OK])
            .then(v => {
                if (v == BUTTON_GOTO_DOC) {
                    open(DOC_URL);
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
    let { lint } = state.config();

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
        EvaluateMiddleWare.loadFile().then((resolved) => {
            chan.show(true);
        }).catch((reason) => {
            chan.show(true);
        });
    }));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateSelection', EvaluateMiddleWare.evaluateCurrentForm));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateCurrentTopLevelForm', EvaluateMiddleWare.evaluateTopLevelForm));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateSelectionReplace', EvaluateMiddleWare.evaluateSelectionReplace));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateSelectionAsComment', EvaluateMiddleWare.evaluateSelectionAsComment));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateTopLevelFormAsComment', EvaluateMiddleWare.evaluateTopLevelFormAsComment));
    context.subscriptions.push(vscode.commands.registerCommand('calva.togglePrettyPrint', EvaluateMiddleWare.togglePrettyPrint));
    context.subscriptions.push(vscode.commands.registerCommand('calva.lintFile', LintMiddleWare.lintDocument));
    context.subscriptions.push(vscode.commands.registerCommand('calva.runTestUnderCursor', TestRunnerMiddleWare.runTestUnderCursorCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.runNamespaceTests', TestRunnerMiddleWare.runNamespaceTestsCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.runAllTests', TestRunnerMiddleWare.runAllTestsCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.rerunTests', TestRunnerMiddleWare.rerunTestsCommand));

    context.subscriptions.push(vscode.commands.registerCommand('calva.clearInlineResults', annotations.clearEvaluationDecorations));
    context.subscriptions.push(vscode.commands.registerCommand('calva.copyAnnotationHoverText', annotations.copyHoverTextCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.copyLastResults', evaluate.copyLastResultCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.requireREPLUtilities', evaluate.requireREPLUtilitiesCommand));

    context.subscriptions.push(vscode.commands.registerCommand('calva.refresh', refresh.refresh));
    context.subscriptions.push(vscode.commands.registerCommand('calva.refreshAll', refresh.refreshAll));

    context.subscriptions.push(vscode.commands.registerCommand('calva.clearREPLWindowHistory', replWindow.clearHistory));

    // Temporary command to teach new default keyboard shortcut chording key
    context.subscriptions.push(vscode.commands.registerCommand('calva.tellAboutNewChordingKey', () => {
        vscode.window.showInformationMessage(`The ”Calva key” has changed. It is now: ctrl+alt+c`);
    }));

    // Initial set of the provided contexts
    vscode.commands.executeCommand("setContext", "calva:replWindowActive", false);
    vscode.commands.executeCommand("setContext", "calva:launching", false);
    vscode.commands.executeCommand("setContext", "calva:connected", false);
    vscode.commands.executeCommand("setContext", "calva:connecting", false);
    vscode.commands.executeCommand("setContext", "calva:pareditValid", false);

    // PROVIDERS
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(state.documentSelector, new CalvaCompletionItemProvider()));
    context.subscriptions.push(vscode.languages.registerHoverProvider(state.documentSelector, new HoverProvider()));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(state.documentSelector, new DefinitionProvider()));

    vscode.workspace.registerTextDocumentContentProvider('jar', new TextDocumentContentProvider());

    // //EVENTS
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument((document) => {
        onDidOpen(document);
    }));
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document) => {
        onDidSave(document);
    }));
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
        const isClojureFile = editor && editor.document.languageId == 'clojure';
        if (isClojureFile) {
            vscode.commands.executeCommand("setContext", "calva:replWindowActive", false);
            vscode.commands.executeCommand("setContext", "calva:pareditValid", true);
        } else if (editor) {
            if (!replWindow.activeReplWindow()) {
                vscode.commands.executeCommand("setContext", "calva:pareditValid", editor.document.languageId != "Log");
            } else {
                vscode.commands.executeCommand("setContext", "calva:replWindowActive", true);
                vscode.commands.executeCommand("setContext", "calva:pareditValid", true);
            }
        } else {
            vscode.commands.executeCommand("setContext", "calva:pareditValid", false);
        }
        status.update();
        if (editor && editor.document && editor.document.fileName) {
            const fileExtIfClj = editor.document.fileName.match(/\.clj[cs]?/);
            if (fileExtIfClj && fileExtIfClj.length && state.config().syncReplNamespaceToCurrentFile) {
                replWindow.setREPLNamespace(util.getDocumentNamespace(editor.document))
                    .catch(reasons => { console.warn(`Namespace sync failed, becauase: ${reasons}`) });
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

    vscode.commands.executeCommand('setContext', 'calva:activated', true);

    greetings.activationGreetings(chan, lint);


    chan.appendLine("Start the REPL with the command *Start Project REPL and connect (aka Jack-in)*.")
    chan.appendLine("Default keybinding for Jack-in: ctrl+alt+c ctrl+alt+j");
    state.analytics().logPath("/activated").logEvent("LifeCycle", "Activated").send();

    if (!cwExtension) {
        highlight.activate(context);
    } else {
        vscode.window.showErrorMessage("Clojure Warrior extension detected. Please uninstall it before continuing to use Calva.", ...["Got it.","Will do!"]);
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
