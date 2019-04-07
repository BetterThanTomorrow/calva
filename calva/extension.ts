import * as vscode from 'vscode';
import * as paredit from "./paredit/extension";
import * as fmt from "./calva-fmt/ts/extension";
import * as state from './state';
import * as jackIn from './nrepl/jack-in';
import status from './status';
import connector from './connector';
import terminal from './terminal';
import CalvaCompletionItemProvider from './providers/completion';
import TextDocumentContentProvider from './providers/content';
import HoverProvider from './providers/hover';
import { DefinitionProvider, WslDefinitionProvider } from './providers/definition';
import EvaluateMiddleWare from './repl/middleware/evaluate';
import LintMiddleWare from './repl/middleware/lint';
import TestRunnerMiddleWare from './repl/middleware/testRunner';
import annotations from './providers/annotations';
import select from './repl/middleware/select';
import evaluate from "./repl/middleware/evaluate"
import * as replWindow from "./repl-window";
import { format } from 'url';
import * as greetings from "./greet";

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
        }
    } else if (evaluate) {
        EvaluateMiddleWare.evaluateFile(document);
    }
    if (lint) {
        LintMiddleWare.lintDocument(document);
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
    let fmtExtension = vscode.extensions.getExtension('cospaia.calva-fmt'),
        pareEditExtension = vscode.extensions.getExtension('cospaia.paredit-revived');
    
    state.setExtensionContext(context);
    
    if (!fmtExtension) {
        fmt.activate(context);
    } else {
        vscode.window.showErrorMessage("Calva Format extension detected, which will break things. Please uninstall it before continuing using Calva.", ...["Got it. Will do!"]); 
    }
    if (!pareEditExtension) {
        paredit.activate(context);
    } else {
        vscode.window.showErrorMessage("Calva Paredit extension detected, which can cause pronlems. Please uninstall it.", ...["Got it. Doing it!"]);
    }

    replWindow.activate(context);
    
    let chan = state.outputChannel();
    chan.appendLine("Calva activated.");
    let {
        autoConnect,
        lint,
        useWSL
    } = state.config();

    status.update();

    // COMMANDS
    context.subscriptions.push(vscode.commands.registerCommand('calva.jackIn', jackIn.calvaJackIn))

    context.subscriptions.push(vscode.commands.registerCommand('calva.connect', connector.connect));
    context.subscriptions.push(vscode.commands.registerCommand('calva.reconnect', connector.reconnect));
    context.subscriptions.push(vscode.commands.registerCommand('calva.toggleCLJCSession', connector.toggleCLJCSession));
    context.subscriptions.push(vscode.commands.registerCommand('calva.recreateCljsRepl', connector.recreateCljsRepl));
    context.subscriptions.push(vscode.commands.registerCommand('calva.selectCurrentForm', select.selectCurrentForm));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateFile', EvaluateMiddleWare.evaluateFile));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateSelection', EvaluateMiddleWare.evaluateSelection));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateCurrentTopLevelForm', EvaluateMiddleWare.evaluateTopLevelForm));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateSelectionPrettyPrint', EvaluateMiddleWare.evaluateSelectionPrettyPrint));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateCurrentTopLevelFormPrettyPrint', EvaluateMiddleWare.evaluateCurrentTopLevelFormPrettyPrint));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateSelectionReplace', EvaluateMiddleWare.evaluateSelectionReplace));
    context.subscriptions.push(vscode.commands.registerCommand('calva.lintFile', LintMiddleWare.lintDocument));
    context.subscriptions.push(vscode.commands.registerCommand('calva.runNamespaceTests', TestRunnerMiddleWare.runNamespaceTestsCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.runAllTests', TestRunnerMiddleWare.runAllTestsCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.rerunTests', TestRunnerMiddleWare.rerunTestsCommand));

    context.subscriptions.push(vscode.commands.registerCommand('calva.loadNamespace', terminal.loadNamespaceCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.setREPLNamespace', terminal.setREPLNamespaceCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evalCurrentFormInREPLWindow', terminal.evalCurrentFormInREPLWindowCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evalCurrentTopLevelFormInREPLWindow', terminal.evalCurrentTopLevelFormInREPLWindowCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.clearInlineResults', annotations.clearEvaluationDecorations));
    context.subscriptions.push(vscode.commands.registerCommand('calva.copyLastResults', evaluate.copyLastResultCommand));

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
        paredit.updatePareditEnabled();
        status.update();
        if (state.config().syncReplNamespaceToCurrentFile) {
            terminal.setREPLNamespace()
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

    //Try to connect using an existing .nrepl-port file, searching the root-directory
    if (autoConnect) {
        chan.appendLine("Autoconnecting... (This can be disabled in Settings)");
        connector.autoConnect();
    } else {
        chan.appendLine("Autoconnect disabled in Settings.")
    }
    
    return {
        hasParedit: true,
        hasFormatter: true
    }
}

function deactivate() {
    paredit.deactivate()
    jackIn.killAllProcesses();
}


export { activate, deactivate };
