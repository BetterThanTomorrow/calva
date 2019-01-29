import * as vscode from "vscode";
import { cljSession, cljsSession } from "./connector"
import * as path from "path";
import * as fs from "fs";
import { readFileSync } from "fs";
import { NReplEvaluation, NReplSession } from "./nrepl";

// REPL

export function activeReplWindow() {
    for(let w in replWindows) {
        if(replWindows[w].panel.active)
            return replWindows[w];
    }
}


class REPLWindow {
    evaluation: NReplEvaluation;

    constructor(public panel: vscode.WebviewPanel, public session: NReplSession, public type: "clj" | "cljs") {    
        vscode.commands.executeCommand("setContext", "calva:inRepl", true)

        this.panel.webview.onDidReceiveMessage(async (msg) => {
            if(msg.type == "init")
                this.panel.webview.postMessage({ type: "init", value: "", ns: this.ns });
    
            if(msg.type == "interrupt" && this.evaluation)
                this.evaluation.interrupt();
            
            if(msg.type == "read-line") {
                this.evaluation = this.session.eval(msg.line, {
                                stderr: m => this.panel.webview.postMessage({type: "stderr", value: m}),
                                stdout: m => this.panel.webview.postMessage({type: "stdout", value: m})})
                try {
                    this.panel.webview.postMessage({type: "repl-response", value: await this.evaluation.value, ns: this.evaluation.ns || this.ns});
                } catch(e) {
                    this.panel.webview.postMessage({type: "repl-error", ex: e});
                    let stacktrace = await this.session.stacktrace();
                    this.panel.webview.postMessage({type: "repl-ex", ex: JSON.stringify(stacktrace)});
                }
                this.evaluation = null;
            }
    
            if(msg.type == "goto-file") {
                vscode.workspace.openTextDocument(vscode.Uri.parse(msg.file)).then(d =>  {
                    let pos = new vscode.Position(msg.line-1, 0);
                    vscode.window.showTextDocument(d, { viewColumn: vscode.ViewColumn.One, selection: new vscode.Range(pos, pos)})
                })
            }
        })

        this.panel.onDidDispose(e => {
            if(this.evaluation)
                this.evaluation.interrupt();
            delete replWindows[this.type]
            this.session.close();
            session.client.removeOnClose(this.onClose);
        })

        panel.onDidChangeViewState(e => {
            vscode.commands.executeCommand("setContext", "calva:inRepl", e.webviewPanel.active)
        })

        let html = readFileSync(path.join(ctx.extensionPath, "html/index.html")).toString()
        html = html.replace("{{baseUri}}", getUrl())
        html = html.replace("{{script}}", getUrl("/main.js"))
        html = html.replace("{{logo}}", getUrl("/clojure-logo.svg"))
        panel.webview.html = html;

        this.init(session);
    }

    onClose = () => this.panel.webview.postMessage({ type: "disconnected" });
    ns: string = "user";
    async init(session: NReplSession) {
        this.session = session;
        let res = this.session.eval("*ns*");
        await res.value;
        this.ns = res.ns;
        session.client.onClose(this.onClose);

    }

    executeCommand(command: string) {
        this.panel.webview.postMessage({type: "ui-command", value: command});
    }
}

let ctx: vscode.ExtensionContext

let replWindows: {[id: string]: REPLWindow} = {};

function getUrl(name?: string) {
    if(name)
        return vscode.Uri.file(path.join(ctx.extensionPath, "html", name)).with({ scheme: 'vscode-resource' }).toString()
    else
        return vscode.Uri.file(path.join(ctx.extensionPath, "html")).with({ scheme: 'vscode-resource' }).toString()
}

export async function openReplWindow(mode: "clj" | "cljs" = "clj") {
    if(replWindows[mode]) {
        replWindows[mode].panel.reveal();
        return replWindows[mode];
    }
    const panel = vscode.window.createWebviewPanel("replInteractor", "REPL Interactor", vscode.ViewColumn.Two, { retainContextWhenHidden: true, enableScripts: true, localResourceRoots: [vscode.Uri.file(path.join(ctx.extensionPath, 'html'))] })    
    let session = mode == "clj" ? cljSession : cljsSession;
    session = await session.clone();
    return replWindows[mode] = new REPLWindow(panel, session, mode);
}

export function activate(context: vscode.ExtensionContext) {
    ctx = context;


    context.subscriptions.push(vscode.commands.registerCommand('calva.openCljReplWindow', () => openReplWindow("clj")));
    context.subscriptions.push(vscode.commands.registerCommand('calva.openCljsReplWindow', () => openReplWindow("cljs")));
}