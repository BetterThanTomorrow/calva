import * as vscode from 'vscode';
import * as paredit from "./paredit/extension";
import * as fmt from "./calva-fmt/ts/extension";
import * as state from './state';
import * as jackIn from './nrepl/jack-in';
import * as util from './utilities'
import status from './status';
import connector from './connector';
import CalvaCompletionItemProvider from './providers/completion';
import TextDocumentContentProvider from './providers/content';
import HoverProvider from './providers/hover';
import { DefinitionProvider, WslDefinitionProvider } from './providers/definition';
import EvaluateMiddleWare from './evaluate';
import LintMiddleWare from './lint';
import TestRunnerMiddleWare from './testRunner';
import annotations from './providers/annotations';
import select from './select';
import evaluate from "./evaluate"
import refresh from "./refresh";
import * as replWindow from "./repl-window";
import { format } from 'url';
import * as greetings from "./greet";
import Analytics from './analytics';

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


function activate(context) {
    state.cursor.set('analytics', new Analytics(context));
    state.analytics().logPath("/start").logEvent("LifeCycle", "Started").send();

    let legacyExtension = vscode.extensions.getExtension('cospaia.clojure4vscode'),
        fmtExtension = vscode.extensions.getExtension('cospaia.calva-fmt'),
        pareEditExtension = vscode.extensions.getExtension('cospaia.paredit-revived');

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

    let chan = state.outputChannel();
    chan.appendLine("Calva activated.");
    let {
        lint,
        useWSL
    } = state.config();

    status.update();

    // COMMANDS
    context.subscriptions.push(vscode.commands.registerCommand('calva.jackInOrConnect', () => {
        vscode.window.showQuickPick(["Start a REPL server and connect (a.k.a. Jack-in)",
            "Connect to a running REPL server"]
        ).then(v => {
            if (v == "Start a REPL server and connect (a.k.a. Jack-in)") {
                vscode.commands.executeCommand('calva.jackIn');
            } else {
                vscode.commands.executeCommand('calva.connect');
            }
        })
    }));
    context.subscriptions.push(vscode.commands.registerCommand('calva.jackIn', jackIn.calvaJackIn))
    context.subscriptions.push(vscode.commands.registerCommand('calva.connect', connector.connect));
    context.subscriptions.push(vscode.commands.registerCommand('calva.toggleCLJCSession', connector.toggleCLJCSession));
    context.subscriptions.push(vscode.commands.registerCommand('calva.recreateCljsRepl', connector.recreateCljsRepl));
    context.subscriptions.push(vscode.commands.registerCommand('calva.selectCurrentForm', select.selectCurrentForm));
    context.subscriptions.push(vscode.commands.registerCommand('calva.loadFile', EvaluateMiddleWare.loadFile));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateSelection', EvaluateMiddleWare.evaluateSelection));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateCurrentTopLevelForm', EvaluateMiddleWare.evaluateTopLevelForm));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateSelectionPrettyPrint', EvaluateMiddleWare.evaluateSelectionPrettyPrint));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateCurrentTopLevelFormPrettyPrint', EvaluateMiddleWare.evaluateCurrentTopLevelFormPrettyPrint));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateSelectionReplace', EvaluateMiddleWare.evaluateSelectionReplace));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateSelectionAsComment', EvaluateMiddleWare.evaluateSelectionAsComment));
    context.subscriptions.push(vscode.commands.registerCommand('calva.lintFile', LintMiddleWare.lintDocument));
    context.subscriptions.push(vscode.commands.registerCommand('calva.runNamespaceTests', TestRunnerMiddleWare.runNamespaceTestsCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.runAllTests', TestRunnerMiddleWare.runAllTestsCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.rerunTests', TestRunnerMiddleWare.rerunTestsCommand));

    context.subscriptions.push(vscode.commands.registerCommand('calva.clearInlineResults', annotations.clearEvaluationDecorations));
    context.subscriptions.push(vscode.commands.registerCommand('calva.copyLastResults', evaluate.copyLastResultCommand));

    context.subscriptions.push(vscode.commands.registerCommand('calva.refresh', refresh.refresh));
    context.subscriptions.push(vscode.commands.registerCommand('calva.refreshAll', refresh.refreshAll));

    context.subscriptions.push(vscode.commands.registerCommand('calva.clearREPLWindowHistory', replWindow.clearHistory));

    // Temporary command to teach new default keyboard shortcut chording key
    context.subscriptions.push(vscode.commands.registerCommand('calva.tellAboutNewChordingKey', () => {
        vscode.window.showInformationMessage(`The ”Calva key” has changed. It is now: ctrl+alt+c`);
    }));


    // PROVIDERS
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(state.mode, new CalvaCompletionItemProvider()));
    context.subscriptions.push(vscode.languages.registerHoverProvider(state.mode, new HoverProvider()));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(state.mode, useWSL ? new WslDefinitionProvider() : new DefinitionProvider()));

    vscode.workspace.registerTextDocumentContentProvider('jar', new TextDocumentContentProvider());

    // //EVENTS
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument((document) => {
        onDidOpen(document);
    }));
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document) => {
        onDidSave(document);
    }));
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
        // paredit.updatePareditEnabled();
        status.update();
        if (editor.document && editor.document.fileName.match(/\.clj[cs]?/).length && state.config().syncReplNamespaceToCurrentFile) {
            replWindow.setREPLNamespace(util.getDocumentNamespace(editor.document))
                .catch(reason => { console.warn(`Namespace sync failed, becauase: ${reason}`) });
        }
    }));
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(annotations.onDidChangeTextDocument))
    context.subscriptions.push(new vscode.Disposable(() => {
        connector.disconnect();
        chan.dispose();
    }));

    // context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
    //     console.log(event);
    // }));

    vscode.commands.executeCommand('setContext', 'calva:activated', true);

    greetings.activationGreetings(chan, lint);


    chan.appendLine("Start the REPL with the command *Start Project REPL and connect (aka Jack-in)*.")
    chan.appendLine("Default keybinding for Jack-in: ctrl+alt+c ctrl+alt+j");
    state.analytics().logPath("/activated").logEvent("LifeCycle", "Activated").send();

    return {
        hasParedit: true,
        hasFormatter: true
    }
}

function deactivate() {
    state.analytics().logEvent("LifeCycle", "Dectivated").send();
    paredit.deactivate()
}


export { activate, deactivate };
