import * as vscode from "vscode";
import { cljSession, cljsSession } from "./connector"
import * as path from "path";
import * as fs from "fs";
import * as state from "./state";
import status from "./status"
import { readFileSync } from "fs";
import { NReplEvaluation, NReplSession } from "./nrepl";

import annotations from './providers/annotations';
import * as util from './utilities';
import evaluate from './evaluate';
import select from './select';

// REPL

export function activeReplWindow() {
    let currentDoc: vscode.TextDocument = util.getDocument({});
    if (!currentDoc.fileName.match(/\.clj[cs]$/)) {
        for (let w in replWindows) {
            if (replWindows[w].panel.active)
                return replWindows[w];
        }
    }
    return undefined;
}


class REPLWindow {
    evaluation: NReplEvaluation;

    initialized: Promise<void>;

    useBuffer = false;
    buffer = [];

    constructor(public panel: vscode.WebviewPanel,
        public session: NReplSession,
        public type: "clj" | "cljs",
        public cljType: string,
        public cljsType: string) {    
        vscode.commands.executeCommand("setContext", "calva:pareditValid", true)
        this.initialized = new Promise((resolve, reject) => {
            this.panel.webview.onDidReceiveMessage(async (msg) => {
                if(msg.type == "init") {
                    this.postMessage({ type: "init", ns: this.ns, history: state.extensionContext.workspaceState.get(this.type+"-history") || [] });
                    resolve();
                }

                if(msg.type == "history") {
                    let history = (state.extensionContext.workspaceState.get(this.type+"-history") || []) as Array<string>;
                    history.push(msg.line);
                    state.extensionContext.workspaceState.update(this.type+"-history", history);
                }

                if(msg.type == "complete") {
                    let result = await this.session.complete(this.ns, msg.symbol, msg.context);
                    this.postMessage({ type: "complete", data: result })
                }
        
                if(msg.type == "interrupt" && this.evaluation)
                    this.evaluation.interrupt();
                
                if(msg.type == "read-line") {
                    this.replEval(msg.line)
                }
        
                if(msg.type == "goto-file") {
                    vscode.workspace.openTextDocument(vscode.Uri.parse(msg.file)).then(d =>  {
                        let pos = new vscode.Position(msg.line-1, 0);
                        vscode.window.showTextDocument(d, { viewColumn: vscode.ViewColumn.One, selection: new vscode.Range(pos, pos)})
                    })
                }

                if(msg.type == "info") {
                    let result = await this.session.info(msg.ns, msg.symbol);
                    this.postMessage({ type: "info", data: result });
                }
            })
        })

        this.panel.onDidDispose(e => {
            if(this.evaluation)
                this.evaluation.interrupt();
            delete replWindows[this.type]
            this.session.close();
            session.removeOnCloseHandler(this.onClose);
        })

        panel.onDidChangeViewState(e => {
            this.useBuffer = !e.webviewPanel.visible;
            
            if(e.webviewPanel.visible) {
                this.buffer.forEach(x => this.panel.webview.postMessage(x))
                this.buffer = [];
            }
            status.update();
        })
        panel.iconPath = vscode.Uri.file(path.join(ctx.extensionPath, "html", "/calva-icon.png"));

        const cljTypeSlug = `clj-type-${cljType.replace(/ /, "-").toLowerCase()}`;
        const cljsTypeSlug = `cljs-type-${cljsType.replace(/ /, "-").toLowerCase}`;
        let html = readFileSync(path.join(ctx.extensionPath, "html/index.html")).toString();
        html = html.replace("{{baseUri}}", getUrl());
        html = html.replace("{{script}}", getUrl("/main.js"));
        html = html.replace("{{font}}", getUrl("/fira_code.css"));
        html = html.replace("{{logo}}", getUrl("/calva.png"));
        html = html.replace("{{hero-classes}}", `${type} ${cljTypeSlug} ${cljsTypeSlug}`);
        html = html.replace("{{clj-type-logo}}", getUrl(`/${cljTypeSlug}.png`));
        html = html.replace("{{clj-logo}}", getUrl("/clj.png"));
        html = html.replace("{{cljs-logo}}", getUrl("/cljs.png"));
        html = html.replace("{{cljs-type-logo}}", getUrl((`/${cljsTypeSlug}.png`)));
        panel.webview.html = html;

        this.connect(session);
    }

    postMessage(msg: any) {
        if(this.useBuffer)
            this.buffer.push(msg);
        else
            this.panel.webview.postMessage(msg)
    }

    onClose = () => 
        this.postMessage({ type: "disconnected" });
    
    ns: string = "user";

    /**
     * Connects this repl window to the given session.
     * 
     * @param session the session to connect to this repl window
     */
    async connect(session: NReplSession) {
        this.session = session;
        let res = this.session.eval("nil");
        await res.value;
        this.ns = res.ns;
        session.addOnCloseHandler(this.onClose);
    }

    evaluate(ns: string, text: string) {
        this.postMessage({ type: "do-eval", value: text, ns})
    }

    async setNamespace(ns: string) {
        this.postMessage({ type: "set-ns!", ns});
        this.ns = ns;
    }

    async replEval(line: string, ns?: string) {
        this.evaluation = this.session.eval(line, {
            stderr: m => this.postMessage({type: "stderr", value: m}),
            stdout: m => this.postMessage({type: "stdout", value: m})})
        try {
            this.postMessage({type: "repl-response", value: await this.evaluation.value, ns: this.ns = ns || this.evaluation.ns || this.ns});
        } catch(e) {
            this.postMessage({type: "repl-error", ex: e});
            let stacktrace = await this.session.stacktrace();
            this.postMessage({type: "repl-ex", ex: JSON.stringify(stacktrace)});
        }
        this.evaluation = null;
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

export async function reconnectRepl(mode: "clj" | "cljs", session: NReplSession) {
    if(replWindows[mode]) {
        await replWindows[mode].connect(session)
        replWindows[mode].postMessage({ type: "reconnected", ns: replWindows[mode].ns });
    }
}

export async function openReplWindow(mode: "clj" | "cljs" = "clj", preserveFocus: boolean = false) {
    if(replWindows[mode]) {
        replWindows[mode].panel.reveal(vscode.ViewColumn.Two, preserveFocus);
        return replWindows[mode];
    }
    
    let session = mode == "clj" ? cljSession : cljsSession;
    if(!session) {
        vscode.window.showErrorMessage("Not connected to nREPL");
        return;
    }

    session = await session.clone();
    let title = mode == "clj" ? "CLJ REPL" : "CLJS REPL";
    const panel = vscode.window.createWebviewPanel("replInteractor",
        title, {
            viewColumn: vscode.ViewColumn.Two,
            preserveFocus: preserveFocus
        },
        {
            retainContextWhenHidden: true,
            enableScripts: true, localResourceRoots: [vscode.Uri.file(path.join(ctx.extensionPath, 'html'))]
        });
    const cljType: string = state.extensionContext.workspaceState.get('selectedCljTypeName');
    const cljsType: string = state.extensionContext.workspaceState.get('selectedCljsTypeName');
    let repl = replWindows[mode] = new REPLWindow(panel, session, mode, cljType, cljsType);
    await repl.initialized;
    return repl;
}

function loadNamespaceCommand(focus = true) {
    setREPLNamespace(focus);
}

function setREPLNamespaceCommand() {
    setREPLNamespace(false);
}

async function sendTextToREPLWindow(text, ns?: string) {
    let wnd = await openReplWindow(util.getREPLSessionType());
    if (wnd) {
        let oldNs = wnd.ns;
        if (ns && ns != oldNs)
            await wnd.session.eval("(in-ns '" + ns + ")").value;
        try {
            wnd.evaluate(ns || oldNs, text);
            await wnd.replEval(text, oldNs);
        } finally {
            if (ns && ns != oldNs) {
                await wnd.session.eval("(in-ns '" + oldNs + ")").value;
            }
        }
    }
}

export async function setREPLNamespace(reload = false) {
    let nameSpace = util.getDocumentNamespace();

    if (reload) {
        evaluate.loadFile();
    }
    let wnd = await openReplWindow(util.getREPLSessionType());
    if (wnd) {
        await wnd.session.eval("(in-ns '" + nameSpace + ")").value;
        wnd.setNamespace(nameSpace);
    }
}


function evalCurrentFormInREPLWindow(topLevel = false) {
    let editor = vscode.window.activeTextEditor,
        doc = util.getDocument({}),
        selection = editor.selection,
        codeSelection = null,
        code = "";

    if (selection.isEmpty) {
        codeSelection = select.getFormSelection(doc, selection.active, topLevel);
        annotations.decorateSelection(codeSelection, editor, annotations.AnnotationStatus.REPL_WINDOW);
        code = doc.getText(codeSelection);
    } else {
        codeSelection = selection;
        code = doc.getText(selection);
    }
    if (code !== "") {
        sendTextToREPLWindow(code, util.getNamespace(doc))
    }
}

function evalCurrentFormInREPLWindowCommand() {
    evalCurrentFormInREPLWindow(false);
}

function evalCurrentTopLevelFormInREPLWindowCommand() {
    evalCurrentFormInREPLWindow(true);
}

export function activate(context: vscode.ExtensionContext) {
    ctx = context;
    context.subscriptions.push(vscode.commands.registerCommand('calva.openCljReplWindow', () => openReplWindow("clj")));
    context.subscriptions.push(vscode.commands.registerCommand('calva.openCljsReplWindow', () => openReplWindow("cljs")));
    context.subscriptions.push(vscode.commands.registerCommand('calva.loadNamespace', loadNamespaceCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.setREPLNamespace', setREPLNamespaceCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evalCurrentFormInREPLWindow', evalCurrentFormInREPLWindowCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evalCurrentTopLevelFormInREPLWindow', evalCurrentTopLevelFormInREPLWindowCommand));
}

