import * as vscode from "vscode";
import { nClient } from "./connector"
import * as path from "path";
import * as fs from "fs";
import { readFileSync } from "fs";

// REPL

let replWindows = new Set<REPLWindow>();
export function activeReplWindow() {
    for(let w of replWindows) {
        if(w.panel.active)
            return w;
    }
}


class REPLWindow {
    constructor(public panel: vscode.WebviewPanel) {
        replWindows.add(this);
        panel.onDidDispose(e => {
            replWindows.delete(this);
        })

        vscode.commands.executeCommand("setContext", "calva:inRepl", true)


        panel.onDidChangeViewState(e => {
            vscode.commands.executeCommand("setContext", "calva:inRepl", e.webviewPanel.active)
        })
    }

    executeCommand(command: string) {
        this.panel.webview.postMessage({type: "ui-command", value: command});
    }
}

export function activate(context: vscode.ExtensionContext) {


	function getUrl(name?: string) {
		if(name)
			return vscode.Uri.file(path.join(context.extensionPath, "html", name)).with({ scheme: 'vscode-resource' }).toString()
		else
			return vscode.Uri.file(path.join(context.extensionPath, "html")).with({ scheme: 'vscode-resource' }).toString()
	}

    context.subscriptions.push(vscode.commands.registerCommand('calva.openReplWindow', async function () {
		const panel = vscode.window.createWebviewPanel("replInteractor", "REPL Interactor", vscode.ViewColumn.Active, { retainContextWhenHidden: true, enableScripts: true, localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'html'))] })
		let html = readFileSync(path.join(context.extensionPath, "html/index.html")).toString()
		html = html.replace("{{baseUri}}", getUrl())
		html = html.replace("{{script}}", getUrl("/main.js"))
		html = html.replace("{{logo}}", getUrl("/clojure-logo.svg"))
        panel.webview.html = html;
        
        let session = await nClient.createSession();

        let res = session.eval("*ns*");
        await res.value;
        let ns = res.ns;

        new REPLWindow(panel);
        panel.webview.onDidReceiveMessage(async function (msg) {
            if(msg.type == "init") {
                panel.webview.postMessage({ type: "init", value: "", ns: ns });
            }

            if(msg.type == "read-line") {
                let res = session.eval(msg.line, {
                            stderr: m => panel.webview.postMessage({type: "stderr", value: m}),
                            stdout: m => panel.webview.postMessage({type: "stdout", value: m})})
                try {
                    panel.webview.postMessage({type: "repl-response", value: await res.value, ns: res.ns});
                } catch(e) {
                    panel.webview.postMessage({type: "repl-error", ex: e});
                }
            }
        })      
	}));    
}