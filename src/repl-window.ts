import * as vscode from "vscode";
import { Event, EventEmitter } from 'vscode';
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
import { PrettyPrintingOptions, disabledPrettyPrinter } from "./printer";

/**
 * Event fired when user input is retrieved from the REPL Window.
 */
class ReplOnUserInputEvent {
    readonly replMode: "clj" | "cljs";
    readonly line: string;
    constructor(replMode: "clj" | "cljs", line: string) {
        this.replMode = replMode;
        this.line = line;
    }
}

let onUserInputEmitter = new EventEmitter<ReplOnUserInputEvent>();
const onUserInput: Event<ReplOnUserInputEvent> = onUserInputEmitter.event;

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

    private disposed = false;

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
                    this.postMessage({ type: "init", ns: this.ns, history: this.getHistory() });
                    this.postMessage({ type: "paredit-keymap", keymap: keymap });
                    resolve();
                }

                if (msg.type == "user-input") {
                    onUserInputEmitter.fire(new ReplOnUserInputEvent(this.type, msg.line));
                }

                if (msg.type == "history") {
                    this.addToHistory(String(msg.line));
                }

                if (msg.type == "complete") {
                    this.session.complete(this.ns, msg.symbol, msg.context)
                        .then((value) => {
                            this.postMessage({ type: "complete", data: value })
                        }).catch((e) => { });
                }

                if (msg.type == "interrupt" && this.evaluation) {
                    this.interrupt();
                }

                if (msg.type == "read-line") {
                    this.replEval(msg.line, this.ns, state.config().prettyPrintingOptions);
                }

                if (msg.type == "goto-file") {
                    vscode.workspace.openTextDocument(vscode.Uri.parse(msg.file)).then(d => {
                        let pos = new vscode.Position(msg.line - 1, 0);
                        vscode.window.showTextDocument(d, { viewColumn: vscode.ViewColumn.One, selection: new vscode.Range(pos, pos) })
                    })
                }

                if (msg.type == "info") {
                    this.session.info(msg.ns, msg.symbol)
                        .then((value) => {
                            this.postMessage({ type: "info", data: value });
                        }).catch((e) => { });
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
            this.disposed = true;
            delete replWindows[this.type];
            onUserInputEmitter.fire(new ReplOnUserInputEvent(this.type, "\n"));
            if (this.evaluation) {
                this.evaluation.interrupt();
            }
            // first remove the close handler to avoid
            // sending any messages to the disposed webview.
            session.removeOnCloseHandler(this.onClose);
            this.session.close();
        })

        panel.onDidChangeViewState(e => {
            this.useBuffer = !e.webviewPanel.visible;
            if (e.webviewPanel.visible) {
                this.buffer.forEach(x => this.panel.webview.postMessage(x))
                this.buffer = [];
                setReplViewColumn(this.type, e.webviewPanel.viewColumn);
            }
            status.update();
        })
        panel.iconPath = vscode.Uri.file(path.join(ctx.extensionPath, "assets/images/calva-icon.png"));

        // TODO: Add a custom-cljs.svg
        const cljTypeSlug = `clj-type-${cljType.replace(/ /, "-").toLowerCase()}`;
        const cljsTypeSlug = `cljs-type-${cljsType.replace(/ /, "-").toLowerCase()}`;
        let html = fs.readFileSync(path.join(ctx.extensionPath, "assets/webview.html")).toString();
        let script = panel.webview.asWebviewUri(vscode.Uri.file(path.join(ctx.extensionPath, "out/webview.js"))).toString();
        html = html.replace("{{script}}", script);
        html = html.replace(/{{csp-source}}/g, panel.webview.cspSource);
        html = html.replace("{{logo-symbol}}", panel.webview.asWebviewUri(getImageUrl(`calva-symbol-logo.svg`)).toString());
        html = html.replace(/{{hero-classes}}/g, `${type} ${cljTypeSlug} ${cljsTypeSlug}`);
        html = html.replace(/{{clj-type}}/g, `${cljType.replace(/ /g, "&nbsp;")}`);
        html = html.replace("{{clj-type-logo}}", panel.webview.asWebviewUri(getImageUrl(`${cljTypeSlug}.svg`)).toString());
        html = html.replace("{{clj-logo}}", panel.webview.asWebviewUri(getImageUrl(`clj.svg`)).toString());
        html = html.replace(/{{cljs-type}}/g, `${cljsType.replace(/ /g, "&nbsp;")}`);
        html = html.replace("{{cljs-type-logo}}", panel.webview.asWebviewUri(getImageUrl((`${cljsTypeSlug}.svg`))).toString());
        html = html.replace("{{cljs-logo}}", panel.webview.asWebviewUri(getImageUrl(`cljs.svg`)).toString());
        panel.webview.html = html;

        // set the on close handler.
        this.session.addOnCloseHandler(this.onClose);
    }

    sendAsyncOutput(id: string, text: string) {
        this.postMessage({ type: 'async-stdout', id: id, value: text });
    }

    sendAsyncErrorOutput(id: string, text: string) {
        this.postMessage({ type: 'async-stderr', id: id, value: text });
    }

    reconnect() {
        // evaluate something that really test 
        // the ability of the connected repl.
        let res = this.session.eval("(+ 1 1)");
        res.value.then((v) => {
            if (res.ns) {
                this.ns = res.ns;
            }
            if (res.errorOutput) {
                this.postMessage({ type: "reconnected", ns: this.ns, value: res.errorOutput })
            } else {
                this.postMessage({ type: "reconnected", ns: this.ns })
            }
        }).catch(() => {
            this.postMessage({ type: "reconnected", ns: this.ns })
        });

    }

    postMessage(msg: any) {
        if (!this.disposed) {
            if (this.useBuffer)
                this.buffer.push(msg);
            else
                this.panel.webview.postMessage(msg)
        }
    }

    onClose = () => {
        onUserInputEmitter.fire(new ReplOnUserInputEvent(this.type, "\n"));
        this.postMessage({ type: "disconnected" });
    }

    ns: string = "user";

    evaluate(ns: string, text: string) {
        this.postMessage({ type: "do-eval", value: text, ns })
    }

    async setNamespace(ns: string) {
        this.postMessage({ type: "set-ns!", ns });
        this.ns = ns;
    }

    replEval(line: string, ns: string, pprintOptions: PrettyPrintingOptions) {

        this.interrupt();

        let evaluation = this.session.eval(line, {
            stderr: m => this.postMessage({ type: "stderr", value: m }),
            stdout: m => this.postMessage({ type: "stdout", value: m }),
            stdin: () => this.getUserInput(),
            pprintOptions: pprintOptions
        })
        this.evaluation = evaluation;

        evaluation.value.then((value) => {
            this.evaluation = null;
            this.postMessage({ type: "repl-response", value: value, ns: this.ns = ns || evaluation.ns || this.ns });
            if (evaluation.ns && this.ns != evaluation.ns) {
                // the evaluation changed the namespace so set the new namespace.
                this.setNamespace(evaluation.ns).catch(() => { });
            }
        }).catch((exception) => {
            this.evaluation = null;
            this.postMessage({ type: "repl-error", ex: exception, stacktrace: JSON.stringify(evaluation.stacktrace) });
        })


    }

    executeCommand(command: string) {
        this.panel.webview.postMessage({ type: "ui-command", value: command });
    }

    getHistory(): Array<string> {
        let history = (state.extensionContext.workspaceState.get(this.type + "-history") || []) as Array<string>;
        return (history)
    }

    addToHistory(line: string) {
        let entry = line.trim();
        if (line != "") {
            let history = (state.extensionContext.workspaceState.get(this.type + "-history") || []) as Array<string>;
            let last = "";
            if (history.length > 0) {
                last = history[history.length - 1];
            }
            if (last != line) {
                history.push(entry);
                state.extensionContext.workspaceState.update(this.type + "-history", history);
            }
        }
    }

    clearHistory() {
        state.extensionContext.workspaceState.update(this.type + "-history", []);
    }

    getUserInput(): Promise<string> {
        let input = new Promise<string>((resolve, reject) => {
            let res = onUserInput((event) => {
                if (event.replMode == this.type) {
                    resolve(String(event.line).trim())
                    res.dispose();
                }
            }, this);
            this.panel.reveal();
            this.postMessage({ type: "need-input" });
        });
        return (input);
    }

    interrupt() {
        if (this.evaluation) {
            onUserInputEmitter.fire(new ReplOnUserInputEvent(this.type, "\n"));
            this.evaluation.interrupt();
            this.evaluation = null;
        }
    }

    clear() {
        this.postMessage({ type: "clear", history: this.getHistory(), ns: this.ns });
    }
}

let ctx: vscode.ExtensionContext
let replWindows: { [id: string]: REPLWindow } = {};

function getReplViewColumn(mode: string): vscode.ViewColumn {
    return ctx.workspaceState.get(`replWindowViewColumn-${mode}`);
}

function setReplViewColumn(mode: string, column: vscode.ViewColumn) {
    return ctx.workspaceState.update(`replWindowViewColumn-${mode}`, column);
}

function initReplViewColumns() {
    if (getReplViewColumn('clj') === undefined) {
        setReplViewColumn('clj', vscode.ViewColumn.Two);
    }
    if (getReplViewColumn('cljs') === undefined) {
        setReplViewColumn('cljs', vscode.ViewColumn.Two);
    }
}

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

export function showAsyncOutput(mode: "clj" | "cljs", id: string, text: string, isError: boolean) {
    if (replWindows[mode] && text.trim() != '') {
        if (isError) {
            replWindows[mode].sendAsyncErrorOutput(id, text);
        } else {
            replWindows[mode].sendAsyncOutput(id, text);
        }
    }
}

export async function reconnectReplWindow(mode: "clj" | "cljs") {
    if (replWindows[mode]) {
        replWindows[mode].reconnect();
    }
}

export async function openClojureReplWindows() {
    showReplWindows("clj").catch((e) => {
        console.error(`Failed to show clj REPL window: `, e);
    });
}

export async function openClojureScriptReplWindows() {
    showReplWindows("cljs").catch((e) => {
        console.error(`Failed to show cljs REPL window: `, e);
    });
}

async function showReplWindows(mode: "clj" | "cljs") {

    if (state.deref().get('connected')) {
        if (util.getSession(mode)) {
            if (!isReplWindowOpen(mode)) {
                openReplWindow(mode, true).then(() => {
                    reconnectReplWindow(mode).then(() => {
                    }).catch(e => {
                        console.error(`Failed reconnecting ${mode} REPL window: `, e);
                    });
                }).catch(e => {
                    console.error(`Failed to open ${mode} REPL window: `, e);
                });
            } else {
                if (replWindows[mode]) {
                    replWindows[mode].panel.reveal();
                }
            }
            return;
        }
    }
    vscode.window.showInformationMessage("Not connected to a Clojure REPL server");
}

export async function openReplWindow(mode: "clj" | "cljs" = "clj", preserveFocus: boolean = true) {
    let session = mode == "clj" ? cljSession : cljsSession,
        nreplClient = session.client;

    if (!replWindows[mode]) {
        await createReplWindow(session, mode);
    } else if (!nreplClient.sessions[replWindows[mode].session.sessionId]) {
        replWindows[mode].session = await session.clone();
    }

    replWindows[mode].panel.reveal(getReplViewColumn(mode), preserveFocus);
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
        viewColumn: getReplViewColumn(mode),
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

export function sendTextToREPLWindow(sessionType: "clj" | "cljs", text: string, ns: string) {
    openReplWindow(sessionType, true)
        .then((v) => {
            let wnd = replWindows[sessionType];
            if (wnd) {
                let inNs = ns ? ns : wnd.ns;
                if (ns && ns !== wnd.ns) {
                    const requireEvaluation = wnd.session.eval(`(require '${ns})`);
                    requireEvaluation.value
                        .then((v) => {
                            const inNSEvaluation = wnd.session.eval(`(in-ns '${ns})`)
                            inNSEvaluation.value
                                .then((v) => {
                                    wnd.setNamespace(inNSEvaluation.ns).then((v) => {
                                        wnd.interrupt();
                                        wnd.evaluate(inNs, text);
                                    }).catch((e) => {
                                        vscode.window.showErrorMessage("Error setting namespace: " + e);
                                    });
                                }).catch((e) => {
                                    vscode.window.showErrorMessage("Error evaluation in namespace form: " + e);
                                })
                        }).catch((e) => {
                            vscode.window.showErrorMessage("Error evaluation require form: " + e);
                        })
                } else {
                    wnd.interrupt();
                    wnd.evaluate(inNs, text);
                }
            }
        }).catch((e) => {
            vscode.window.showErrorMessage("Unable to open REPL window: " + e);
        })
}

export async function setREPLNamespace(ns: string, reload = false) {

    if (reload) {
        await evaluate.loadFile({}, undefined, state.config().prettyPrintingOptions);
    }
    let wnd = replWindows[util.getREPLSessionType()];
    if (wnd) {
        await wnd.session.eval("(in-ns '" + ns + ")").value;
        wnd.setNamespace(ns).catch(() => { });
    }
}


function evalCurrentFormInREPLWindow(topLevel: boolean) {
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
        sendTextToREPLWindow(util.getREPLSessionType(), code, util.getNamespace(doc));
    }
}

function evalCurrentFormInREPLWindowCommand() {
    evalCurrentFormInREPLWindow(false,);
}

function evalCurrentTopLevelFormInREPLWindowCommand() {
    evalCurrentFormInREPLWindow(true);
}

export type customREPLCommandSnippet = { name: string, snippet: string, repl: string, ns?: string };

function sendCustomCommandSnippetToREPLCommand() {
    let pickCounter = 1,
        configErrors: { "name": string, "keys": string[] }[] = [];
    const snippets = state.config().customREPLCommandSnippets as customREPLCommandSnippet[],
        snippetPicks = _.map(snippets, (c: customREPLCommandSnippet) => {
            const undefs = ["name", "snippet", "repl"].filter(k => {
                return !c[k];
            })
            if (undefs.length > 0) {
                configErrors.push({ "name": c.name, "keys": undefs });
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
                sendTextToREPLWindow(repl ? repl : "clj", command, ns);
            }
        }).catch(() => { });
    } else {
        vscode.window.showInformationMessage("No snippets configured. Configure snippets in `calva.customREPLCommandSnippets`.", ...["OK"]);
    }
}

export function activate(context: vscode.ExtensionContext) {
    ctx = context;
    initReplViewColumns();
    context.subscriptions.push(vscode.commands.registerCommand('calva.openCljReplWindow', openClojureReplWindows));
    context.subscriptions.push(vscode.commands.registerCommand('calva.openCljsReplWindow', openClojureScriptReplWindows));
    context.subscriptions.push(vscode.commands.registerCommand('calva.loadNamespace', loadNamespaceCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.setREPLNamespace', setREPLNamespaceCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evalCurrentFormInREPLWindow', evalCurrentFormInREPLWindowCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evalCurrentTopLevelFormInREPLWindow', evalCurrentTopLevelFormInREPLWindowCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.runCustomREPLCommand', sendCustomCommandSnippetToREPLCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.clearClojureREPLWindow', clearClojureREPLWindowAndHistory));
    context.subscriptions.push(vscode.commands.registerCommand('calva.clearClojureScriptREPLWindow', clearClojureScriptREPLWindowAndHistory));
}

function clearClojureREPLWindowAndHistory() {
    clearREPLWindowAndHistory("clj")
}

function clearClojureScriptREPLWindowAndHistory() {
    clearREPLWindowAndHistory("cljs")
}

function clearREPLWindowAndHistory(mode: "clj" | "cljs") {

    if (isReplWindowOpen(mode)) {
        vscode.window.showWarningMessage(
            `Are you sure you want to clear the ${mode} REPL window and its history?`,
            { modal: true },
            ...["Ok"])
            .then(answer => {
                if (answer == "Ok") {
                    if (replWindows[mode]) {
                        const wnd = replWindows[mode];
                        wnd.interrupt();
                        wnd.clearHistory();
                        wnd.panel.reveal();
                        wnd.clear();
                        wnd.reconnect();
                    }
                }
            });
    } else {
        vscode.window.showInformationMessage(`No ${mode} REPL Window found.`);
    }
}
