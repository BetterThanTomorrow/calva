import * as vscode from 'vscode';
import * as path from "path";

import * as state from './state';
import status from './status';
import connector from './connector';
import terminal from './terminal';
import CalvaCompletionItemProvider from './providers/completion';
import TextDocumentContentProvider from './providers/content';
import HoverProvider from './providers/hover';
import DefinitionProvider from './providers/definition';
import EvaluateMiddleWare from './repl/middleware/evaluate';
import LintMiddleWare from './repl/middleware/lint';
import TestRunnerMiddleWare from './repl/middleware/testRunner';
import annotations from './providers/annotations';
import select from './repl/middleware/select';
import * as util from './utilities';
import evaluate from "./repl/middleware/evaluate"
const nreplMessage = require('@cospaia/calva-lib/lib/calva.repl.message');

import { readFileSync } from 'fs';
const greetings = require('@cospaia/calva-lib/lib/calva.greet');

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
    let chan = state.deref().get('outputChannel');
    chan.appendLine("Calva activated.");
    let {
        autoConnect,
        lint
    } = state.config();

    status.update();

    // COMMANDS
    context.subscriptions.push(vscode.commands.registerCommand('calva.openReplWindow', () => {
		const panel = vscode.window.createWebviewPanel("replInteractor", "REPL Interactor", vscode.ViewColumn.Active, { retainContextWhenHidden: true, enableScripts: true, localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'html'))] })
		let html = readFileSync(path.join(context.extensionPath, "html/index.html")).toString()
		html = html.replace("{{baseUri}}", getUrl())
		html = html.replace("{{script}}", getUrl("main.js"))
		html = html.replace("{{logo}}", getUrl("/clojure-logo.svg"))
        panel.webview.html = html;
        

        evaluate.evaluateMsg(nreplMessage.eval_code_msg(util.getSession(), 'nil'), "", "", (res) => {
            let ns;
            for(let response of res) {
                if(response.hasOwnProperty("value"))
                    ns = response.ns;
            }        

            panel.webview.onDidReceiveMessage((msg) => {
                if(msg.type == "init") {
                    panel.webview.postMessage({ type: "init", value: "", ns: ns });
                }

                if(msg.type == "read-line") {
                    evaluate.evaluateMsg(nreplMessage.eval_code_msg(util.getSession(), msg.line), "", "", (res) => {
                        for(let response of res) {
                            if(response.hasOwnProperty("status"))
                                panel.webview.postMessage({type: "done"});
                            if(response.hasOwnProperty("ex"))
                                panel.webview.postMessage({ type: "repl-error", ex: ""+response.ex });
                            if(response.hasOwnProperty("err"))
                                panel.webview.postMessage({ type: "stderr", value: ""+response.err });
                            if(response.hasOwnProperty("value"))
                                panel.webview.postMessage({ type: "repl-response", value: ""+response.value, ns: response.ns });
                            if(response.hasOwnProperty("out")) {
                                panel.webview.postMessage({ type: "stdout", value: ""+response.out});
                            }
                        }
                    });
                }
            })      
        })
	}));

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
    context.subscriptions.push(vscode.commands.registerCommand('calva.openREPLTerminal', terminal.openREPLTerminalCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.loadNamespace', terminal.loadNamespaceCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.setREPLNamespace', terminal.setREPLNamespaceCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evalCurrentFormInREPLTerminal', terminal.evalCurrentFormInREPLTerminalCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evalCurrentTopLevelFormInREPLTerminal', terminal.evalCurrentTopLevelFormInREPLTerminalCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.clearInlineResults', annotations.clearEvaluationDecorations));
    context.subscriptions.push(vscode.commands.registerCommand('calva.copyLastResults', evaluate.copyLastResultCommand));

    // PROVIDERS
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(state.mode, new CalvaCompletionItemProvider()));
    context.subscriptions.push(vscode.languages.registerHoverProvider(state.mode, new HoverProvider()));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(state.mode, new DefinitionProvider()));

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

    // REPL
	function getUrl(name?: string) {
		if(name)
			return vscode.Uri.file(path.join(context.extensionPath, "html", name)).with({ scheme: 'vscode-resource' }).toString()
		else
			return vscode.Uri.file(path.join(context.extensionPath, "html")).with({ scheme: 'vscode-resource' }).toString()
	}
}

function deactivate() { }


export { activate, deactivate };
