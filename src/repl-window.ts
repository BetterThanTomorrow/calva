import * as vscode from "vscode";
import { cljSession, cljsSession } from "./connector"
import * as path from "path";
import * as state from "./state";
import status from "./status"
import * as fs from "fs";
import * as _ from "lodash";
import * as paredit from './paredit/extension';
import { NReplEvaluation, NReplSession } from "./nrepl";

import annotations from './providers/annotations';
import * as util from './utilities';
import evaluate from './evaluate';
import select from './select';

// REPL

export function activeReplWindow() {
    for (let w in replWindows) {
        if (replWindows[w].panel.active) {
            return replWindows[w];
        }
    }
    return undefined;
}

export function isReplWindowOpen(mode: "clj" | "cljs" = "clj") {
    // If we find `mode` in the `replWindows` 
    // dictionary, then it is open.
    if (!replWindows[mode]) {
        return (false);
    }
    return (true);
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
                if (msg.type == "init") {
                    let keymap = paredit.getKeyMapConf();
                    this.postMessage({ type: "init", ns: this.ns, history: state.extensionContext.workspaceState.get(this.type + "-history") || [] });
                    this.postMessage({ type: "paredit-keymap", keymap: keymap });
                    resolve();
                }

                if (msg.type == "history") {
                    let history = (state.extensionContext.workspaceState.get(this.type + "-history") || []) as Array<string>;
                    history.push(msg.line);
                    state.extensionContext.workspaceState.update(this.type + "-history", history);
                }

                if (msg.type == "complete") {
                    let result = await this.session.complete(this.ns, msg.symbol, msg.context);
                    this.postMessage({ type: "complete", data: result })
                }

                if (msg.type == "interrupt" && this.evaluation) {
                    this.evaluation.interrupt().catch(() => {});
                }

                if (msg.type == "read-line") {
                    this.replEval(msg.line, this.ns, state.config().pprint).catch(() => {});
                }

                if (msg.type == "goto-file") {
                    vscode.workspace.openTextDocument(vscode.Uri.parse(msg.file)).then(d => {
                        let pos = new vscode.Position(msg.line - 1, 0);
                        vscode.window.showTextDocument(d, { viewColumn: vscode.ViewColumn.One, selection: new vscode.Range(pos, pos) })
                    })
                }

                if (msg.type == "info") {
                    let result = await this.session.info(msg.ns, msg.symbol);
                    this.postMessage({ type: "info", data: result });
                }

                if (msg.type == "focus") {
                    vscode.commands.executeCommand("setContext", "calva:replWindowActive", true);
                    vscode.commands.executeCommand("setContext", "calva:pareditValid", true);
                }

                if (msg.type == "blur") {
                    vscode.commands.executeCommand("setContext", "calva:replWindowActive", false);
                }
            })
        })

        paredit.onPareditKeyMapChanged((keymap) => {
            this.postMessage({ type: "paredit-keymap", keymap: keymap });
        })

        this.panel.onDidDispose((e) => {
            if (this.evaluation)
                this.evaluation.interrupt().catch(() => {});
            delete replWindows[this.type]
            this.session.close();
            session.removeOnCloseHandler(this.onClose);
        })

        panel.onDidChangeViewState(e => {
            this.useBuffer = !e.webviewPanel.visible;
            if (e.webviewPanel.visible) {
                this.buffer.forEach(x => this.panel.webview.postMessage(x))
                this.buffer = [];
                replViewColum[this.type] = e.webviewPanel.viewColumn;
            }
            status.update();
        })
        panel.iconPath = vscode.Uri.file(path.join(ctx.extensionPath, "assets/images/calva-icon.png"));

        // TODO: Add a custom-cljs.svg
        const cljTypeSlug = `clj-type-${cljType.replace(/ /, "-").toLowerCase()}`;
        const cljsTypeSlug = `cljs-type-${cljsType.replace(/ /, "-").toLowerCase()}`;
        let html = fs.readFileSync(path.join(ctx.extensionPath, "assets/webview.html")).toString();
        let script = panel.webview.asWebviewUri(vscode.Uri.file(path.join(ctx.extensionPath, "out/webview.js"))).toString()
        html = html.replace("{{script}}", script);
        html = html.replace("{{logo-symbol}}", panel.webview.asWebviewUri(getImageUrl(`calva-symbol-logo.svg`)).toString());
        html = html.replace(/{{hero-classes}}/g, `${type} ${cljTypeSlug} ${cljsTypeSlug}`);
        html = html.replace("{{clj-type}}", `${cljType.replace(/ /g, "&nbsp;")}`);
        html = html.replace("{{clj-type-logo}}", panel.webview.asWebviewUri(getImageUrl(`${cljTypeSlug}.svg`)).toString());
        html = html.replace("{{clj-logo}}", panel.webview.asWebviewUri(getImageUrl(`clj.svg`)).toString());
        html = html.replace("{{cljs-type}}", `${cljsType.replace(/ /g, "&nbsp;")}`);
        html = html.replace("{{cljs-type-logo}}", panel.webview.asWebviewUri(getImageUrl((`${cljsTypeSlug}.svg`))).toString());
        html = html.replace("{{cljs-logo}}", panel.webview.asWebviewUri(getImageUrl(`cljs.svg`)).toString());
        panel.webview.html = html;

        this.connect().catch(reason => {
            console.error("Problems when connecting: ", reason);
        });
    }

    postMessage(msg: any) {
        if (this.useBuffer)
            this.buffer.push(msg);
        else
            this.panel.webview.postMessage(msg)
    }

    onClose = () => {
        this.postMessage({ type: "disconnected" });
    }

    ns: string = "user";

    /**
     * Connects this repl window to the given session.
     *
     * @param session the session to connect to this repl window
     */
    async connect() {
        let res = this.session.eval("nil");
        await res.value;
        if(res.ns) {
            this.ns = res.ns;
        }
        this.session.addOnCloseHandler(this.onClose);
    }

    evaluate(ns: string, text: string) {
        this.postMessage({ type: "do-eval", value: text, ns })
    }

    async setNamespace(ns: string) {
        this.postMessage({ type: "set-ns!", ns });
        this.ns = ns;
    }

    async replEval(line: string, ns: string, pprint: boolean) {
        this.evaluation = this.session.eval(line, {
            stderr: m => this.postMessage({ type: "stderr", value: m }),
            stdout: m => this.postMessage({ type: "stdout", value: m }),
            pprint: pprint
        })
        try {
            this.postMessage({ type: "repl-response", value: await this.evaluation.value, ns: this.ns = ns || this.evaluation.ns || this.ns });
            if (this.evaluation.ns && this.ns != this.evaluation.ns) {
                // the evaluation changed the namespace so set the new namespace.
                this.setNamespace(this.evaluation.ns).catch(() => {});
            }
        } catch (e) {
            this.postMessage({ type: "repl-error", ex: e });
            let stacktrace = await this.session.stacktrace();
            this.postMessage({ type: "repl-ex", ex: JSON.stringify(stacktrace) });
        }
        this.evaluation = null;
    }

    executeCommand(command: string) {
        this.panel.webview.postMessage({ type: "ui-command", value: command });
    }

    clearHistory() {
        state.extensionContext.workspaceState.update(this.type + "-history", []);
    }
}

let ctx: vscode.ExtensionContext

let replWindows: { [id: string]: REPLWindow } = {};
let replViewColum: { [id: string]: vscode.ViewColumn } = {
    "clj": vscode.ViewColumn.Two,
    "cljs": vscode.ViewColumn.Two
};

export function getReplWindow(mode: "clj" | "cljs") {
    return replWindows[mode];
}

function getImageUrl(name: string) {
    let imagepath = "";
    if (!name) {
        imagepath = path.join(ctx.extensionPath, "assets/images/empty.svg");
    }
    else {
        imagepath = path.join(ctx.extensionPath, "assets/images/", name);
    }

    if (!fs.existsSync(imagepath)) {
        imagepath = path.join(ctx.extensionPath, "assets/images/empty.svg");
    }
    return vscode.Uri.file(imagepath);
}

export async function reconnectReplWindow(mode: "clj" | "cljs") {
    if (replWindows[mode]) {
        await replWindows[mode].connect()
        replWindows[mode].postMessage({ type: "reconnected", ns: replWindows[mode].ns });
    }
}

export async function openClojureReplWindows() {
    if (state.deref().get('connected')) {
        if (util.getSession("clj")) {
            openReplWindow("clj", true).catch(() => {});
            return;
        }
    }
    vscode.window.showInformationMessage("Not connected to a Clojure REPL server");
}

export async function openClojureScriptReplWindows() {
    if (state.deref().get('connected')) {
        if (util.getSession("cljs")) {
            openReplWindow("cljs", true).catch(() => {});
            return;
        }
    }
    vscode.window.showInformationMessage("Not connected to a ClojureScript REPL server");
}

export async function openReplWindow(mode: "clj" | "cljs" = "clj", preserveFocus: boolean = true) {
    let session = mode == "clj" ? cljSession : cljsSession,
        nreplClient = session.client;

    if (!replWindows[mode]) {
        await createReplWindow(session, mode);
    } else if (!nreplClient.sessions[replWindows[mode].session.sessionId]) {
        replWindows[mode].session = await session.clone();
    }

    replWindows[mode].panel.reveal(replViewColum[mode], preserveFocus);
    return replWindows[mode];
}

export async function createReplWindow(session: NReplSession, mode: "clj" | "cljs" = "clj") {
    const nreplClient = session.client;

    if (replWindows[mode]) {
        const modeSession = nreplClient.sessions[replWindows[mode].session.sessionId];
        if (!modeSession || modeSession !== session) {
            replWindows[mode].session = await session.clone();
        }
        return replWindows[mode];
    }

    const sessionClone = await session.clone();
    let title = mode == "clj" ? "CLJ REPL" : "CLJS REPL";
    const panel = vscode.window.createWebviewPanel("replInteractor", title, {
        viewColumn: replViewColum[mode],
        preserveFocus: true
    }, {
        retainContextWhenHidden: true,
        enableScripts: true, localResourceRoots: [
            vscode.Uri.file(path.join(ctx.extensionPath, 'assets')),
            vscode.Uri.file(path.join(ctx.extensionPath, 'out'))
        ]
    });
    const cljType: string = state.extensionContext.workspaceState.get('selectedCljTypeName');
    const cljsType: string = state.extensionContext.workspaceState.get('selectedCljsTypeName');
    let replWin = replWindows[mode] = new REPLWindow(panel, sessionClone, mode, cljType, cljsType);
    await replWin.initialized;
    return replWin;
}

async function loadNamespaceCommand(reload = true) {
    await openReplWindow(util.getREPLSessionType(), reload);
    await setREPLNamespace(util.getDocumentNamespace(), reload).catch(r => { console.error(r) });
}

async function setREPLNamespaceCommand() {
    await openReplWindow(util.getREPLSessionType());
    await setREPLNamespace(util.getDocumentNamespace(), false).catch(r => { console.error(r) });
}

export async function sendTextToREPLWindow(sessionType: "clj" | "cljs", text: string, ns: string, pprint: boolean) {
    const chan = state.outputChannel(),
        wnd = await openReplWindow(sessionType, true);
    if (wnd) {
        const inNs = ns ? ns : wnd.ns;
        if (ns && ns !== wnd.ns) {
            try {
                const requireEvaluation = wnd.session.eval(`(require '${ns})`)
                await requireEvaluation.value;
                const inNSEvaluation = wnd.session.eval(`(in-ns '${ns})`)
                await inNSEvaluation.value;
                if (inNSEvaluation) {
                    wnd.setNamespace(inNSEvaluation.ns).catch(() => {});
                }
            } catch (e) {
                vscode.window.showErrorMessage(`Error loading namespcace "${ns}" for command snippet: ${e}`, ...["OK"]);
                return;
            }
        }
        try {
            wnd.evaluate(inNs, text);
            await wnd.replEval(text, inNs, pprint);
        } catch (e) {
            vscode.window.showErrorMessage("Error running command snippet: " + e, ...["OK"]);
        }
    }
}

export async function setREPLNamespace(ns: string, reload = false) {

    if (reload) {
        await evaluate.loadFile();
    }
    let wnd = replWindows[util.getREPLSessionType()];
    if (wnd) {
        await wnd.session.eval("(in-ns '" + ns + ")").value;
        wnd.setNamespace(ns).catch(() => {});
    }
}


function evalCurrentFormInREPLWindow(topLevel: boolean, pprint: boolean) {
    let editor = vscode.window.activeTextEditor,
        doc = util.getDocument({}),
        selection = editor.selection,
        codeSelection = null,
        code = "";

    if (selection.isEmpty) {
        codeSelection = select.getFormSelection(doc, selection.active, topLevel);
        annotations.decorateSelection("", codeSelection, editor, annotations.AnnotationStatus.REPL_WINDOW);
        code = doc.getText(codeSelection);
    } else {
        codeSelection = selection;
        code = doc.getText(selection);
    }
    if (code !== "") {
        sendTextToREPLWindow(util.getREPLSessionType(), code, util.getNamespace(doc), pprint).catch(() => {});
    }
}

function evalCurrentFormInREPLWindowCommand() {
    evalCurrentFormInREPLWindow(false, state.config().pprint);
}

function evalCurrentTopLevelFormInREPLWindowCommand() {
    evalCurrentFormInREPLWindow(true, state.config().pprint);
}

export type customREPLCommandSnippet = { name: string, snippet: string, repl: string, ns?: string };

function sendCustomCommandSnippetToREPLCommand() {
    let pickCounter = 1,
        configErrors: {"name": string, "keys": string[]}[] = [];
    const snippets = state.config().customREPLCommandSnippets as customREPLCommandSnippet[],
        snippetPicks = _.map(snippets, (c: customREPLCommandSnippet) => {
            const undefs = ["name", "snippet", "repl"].filter(k => {
                return !c[k];
            })
            if (undefs.length > 0) {
                configErrors.push({"name": c.name, "keys": undefs});
            }
            return `${pickCounter++}: ${c.name} (${c.repl})`;
        }),
        snippetsDict = {};
        pickCounter = 1;

    if (configErrors.length > 0) {
        vscode.window.showErrorMessage("Errors found in the `calva.customREPLCommandSnippets` setting. Values missing for: " + JSON.stringify(configErrors), "OK");
        return;
    }
    snippets.forEach((c: customREPLCommandSnippet) => {
        snippetsDict[`${pickCounter++}: ${c.name} (${c.repl})`] = c;
    });

    if (snippets && snippets.length > 0) {
        util.quickPickSingle({
            values: snippetPicks,
            placeHolder: "Choose a command to run at the REPL",
            saveAs: "runCustomREPLCommand"
        }).then(async (pick) => {
            if (pick && snippetsDict[pick] && snippetsDict[pick].snippet) {
                const command = snippetsDict[pick].snippet,
                    ns = snippetsDict[pick].ns ? snippetsDict[pick].ns : "user",
                    repl = snippetsDict[pick].repl ? snippetsDict[pick].repl : "clj";
                sendTextToREPLWindow(repl ? repl : "clj", command, ns, false).catch(() => {});
            }
        }).catch(() => {});
    } else {
        vscode.window.showInformationMessage("No snippets configured. Configure snippets in `calva.customREPLCommandSnippets`.", ...["OK"]);
    }
}

export function activate(context: vscode.ExtensionContext) {
    ctx = context;
    context.subscriptions.push(vscode.commands.registerCommand('calva.openCljReplWindow', openClojureReplWindows));
    context.subscriptions.push(vscode.commands.registerCommand('calva.openCljsReplWindow', openClojureScriptReplWindows));
    context.subscriptions.push(vscode.commands.registerCommand('calva.loadNamespace', loadNamespaceCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.setREPLNamespace', setREPLNamespaceCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evalCurrentFormInREPLWindow', evalCurrentFormInREPLWindowCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evalCurrentTopLevelFormInREPLWindow', evalCurrentTopLevelFormInREPLWindowCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.runCustomREPLCommand', sendCustomCommandSnippetToREPLCommand));
}

export function clearHistory() {
    vscode.window.showWarningMessage("Are you sure you want to clear the REPL window history?", ...["No", "Yes"])
        .then(answer => {
            if (answer == "Yes") {
                let wnd = activeReplWindow();
                if (wnd) {
                    wnd.clearHistory();
                    state.outputChannel().appendLine("REPL window history cleared.\nNow close the window and open it again.");
                } else {
                    state.outputChannel().appendLine("No active REPL window found.");
                }
            }
        });
}
