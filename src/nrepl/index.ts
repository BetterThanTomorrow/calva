import * as net from "net";
import { BEncoderStream, BDecoderStream } from "./bencode";
import * as cider from './cider'
import * as state from './../state';
import * as util from '../utilities';
import { PrettyPrintingOptions, disabledPrettyPrinter, getServerSidePrinter } from "../printer";
import * as debug from "../debugger/calva-debug";
import * as vscode from 'vscode';
import debugDecorations from '../debugger/decorations';
import * as outputWindow from '../results-output/results-doc';
import { formatAsLineComments } from '../results-output/util';
import type { ReplSessionType } from '../config';
import { getStateValue, prettyPrint } from '../../out/cljs-lib/cljs-lib';
import { getConfig } from '../config';
import { log, Direction, loggingEnabled } from './logging';

function hasStatus(res: any, status: string): boolean {
    return res.status && res.status.indexOf(status) > -1;
}

// When a command fails becuase of an unknown-op (usually caused by missing
// middleware), we can mark the operation as failed, so that we can show a message
// in the UI to the user.
// https://nrepl.org/nrepl/design/handlers.html
// If the handler being used by an nREPL server does not recognize or cannot
// perform the operation indicated by a request message’s :op, then it should
// respond with a message containing a :status of "unknown-op".
function resultHandler(resolve: any, reject: any) {
    return (res: any): boolean => {
        if (hasStatus(res, "unknown-op")) {
            reject("The server does not recognize or cannot perform the '" + res.op + "' operation");
        } else {
            resolve(res);
        }
        return true;
    }
}

/** An nREPL client */
export class NReplClient {
    private _nextId = 0;

    /** Returns a new id unique to this client */
    get nextId() {
        return ++this._nextId + "";
    }

    private socket: net.Socket
    private encoder = new BEncoderStream();
    private decoder = new BDecoderStream();
    session: NReplSession;

    /** Result of running describe at boot, unused */
    describe: any;

    /** Tracks all sessions */
    sessions: { [id: string]: NReplSession } = {};

    ns: string = 'user';

    private constructor(socket: net.Socket, onError: (e) => void) {
        this.socket = socket;
        this.socket.on("error", e => {
            console.error(e);
            state.connectionLogChannel().appendLine(e.message);
            onError(e);
        })
        this.socket.on("close", e => {
            console.log("Socket closed")
            state.connectionLogChannel().appendLine("Socket closed");
            this._closeHandlers.forEach(x => x(this));
            for (let x in this.sessions) {
                this.sessions[x]._onCloseHandlers.forEach(s => s(this.sessions[x]))
            }
        })
        this.encoder.pipe(this.socket);
        this.socket.pipe(this.decoder);
    }

    private _closeHandlers: ((c: NReplClient) => void)[] = []
    addOnCloseHandler(fn: (c: NReplClient) => void) {
        if (this._closeHandlers.indexOf(fn) == -1)
            this._closeHandlers.push(fn);
    }

    removeOnCloseHandler(fn: (c: NReplClient) => void) {
        let idx = this._closeHandlers.indexOf(fn);
        if (idx != -1)
            this._closeHandlers.splice(idx, 1);
    }

    /**
     * Returns a new session.
     */
    createSession() {
        return this.session.clone();
    }

    /**
     * Send a Javascript object over the wire as bencode.
     * @param data
     */
    write(data: any) {
        this.encoder.write(data);
        if (loggingEnabled()) {
            log(data, Direction.ClientToServer);
        }
    }

    close() {
        for (let id in this.sessions) {
            this.sessions[id].close();
        }
        this.disconnect();
    }

    disconnect() {
        this.socket.destroy();
    }

    /**
     * Create a new NRepl client
     */
    static create(opts: { host: string, port: number, onError: (e) => void }) {
        return new Promise<NReplClient>((resolve, reject) => {

            let socket = net.createConnection(opts, () => {

                let nsId = client.nextId
                let cloneId = client.nextId;
                let describeId = client.nextId;

                client.decoder.on("data", (data) => {

                    if (loggingEnabled()) {
                        log(data, Direction.ServerToClient);
                    }

                    debug.onNreplMessage(data);

                    if (!client.describe && data["id"] === describeId) {
                        client.describe = data;
                    } else if (data["id"] === nsId) {
                        if (data["ns"])
                            client.ns = data["ns"];
                        if (hasStatus(data, "done"))
                            client.encoder.write({ "op": "clone", "id": cloneId });
                    } else if (data["id"] === cloneId) {
                        client.session = new NReplSession(data["new-session"], client);
                        client.encoder.write({ "op": "describe", id: describeId, verbose: true, session: data["new-session"] });
                        resolve(client);
                    } else if (data["session"]) {
                        let session = client.sessions[data["session"]];
                        if (session)
                            session._response(data);
                    }
                });
                client.encoder.write({ "op": "eval", code: "*ns*", "id": nsId });

            });
            let client = new NReplClient(socket, opts.onError);
        });
    }
}

export class NReplSession {

    private static Instances: Array<NReplSession> = [];

    private _runningIds: Array<string> = [];

    public _onCloseHandlers: ((c: NReplSession) => void)[] = [];

    addOnCloseHandler(fn: (c: NReplSession) => void) {
        if (this._onCloseHandlers.indexOf(fn) == -1)
            this._onCloseHandlers.push(fn);
    }

    removeOnCloseHandler(fn: (c: NReplSession) => void) {
        let idx = this._onCloseHandlers.indexOf(fn);
        if (idx != -1)
            this._onCloseHandlers.splice(idx, 1);
    }

    constructor(public sessionId: string, public client: NReplClient) {
        client.sessions[sessionId] = this;
        NReplSession.Instances.push(this);
    }

    static getInstances() {
        return (NReplSession.Instances);
    }

    private addRunningID(id: string) {
        if (id) {
            if (!this._runningIds.includes(id)) {
                this._runningIds.push(id);
            }
        }
    }

    messageHandlers: { [id: string]: (msg: any) => boolean } = {};
    replType: ReplSessionType = null;

    close() {
        this.client.write({ op: "close", session: this.sessionId })
        this._runningIds = [];
        delete this.client.sessions[this.sessionId]
        let index = NReplSession.Instances.indexOf(this);
        if (index > -1) {
            NReplSession.Instances.splice(index, 1);
        }
        this._onCloseHandlers.forEach(x => x(this));
    }

    async clone() {
        return new Promise<NReplSession>((resolve, reject) => {
            let id = this.client.nextId;
            this.messageHandlers[id] = (msg) => {
                let sess = new NReplSession(msg["new-session"], this.client);
                resolve(sess);
                return true;
            }
            this.client.write({ op: "clone", session: this.sessionId, id })
        })
    }

    async _defaultMessageHandler(msgData: any) {
        if (msgData["repl-type"]) {
            this.replType = msgData["repl-type"];
        }

        if (msgData.out && !this.replType) {
            this.replType = "clj";
        }

        if (!(msgData.status && msgData.status == "done")) {
            this.addRunningID(msgData.id);
        }

        if ((msgData.out || msgData.err) && this.replType) {
            if (msgData.out) {
                const out = msgData.out.replace(/\n\r?$/, "");
                outputWindow.append(out);
            } else if (msgData.err) {
                const err = formatAsLineComments(msgData.err);
                outputWindow.append(err, _ => {
                    outputWindow.append(outputWindow.getPrompt());
                });
            }
        }
    }

    _response(data: any) {
        if (this.messageHandlers[data.id]) {
            let res = this.messageHandlers[data.id](data);
            if (res)
                delete this.messageHandlers[data.id];
        } else {
            this._defaultMessageHandler(data).then(() => { }, () => { });
        }
    }

    describe(verbose?: boolean) {
        return new Promise<any>((resolve, reject) => {
            let id = this.client.nextId;
            this.messageHandlers[id] = resultHandler(resolve, reject);
            this.client.write({ op: "describe", id: id, session: this.sessionId, verbose });
        })
    }

    listSessions() {
        return new Promise<any>((resolve, reject) => {
            let id = this.client.nextId;
            this.messageHandlers[id] = resultHandler(resolve, reject);
            this.client.write({ op: "ls-sessions", id: id, session: this.sessionId });
        })
    }

    stacktrace() {
        return new Promise<any>((resolve, reject) => {
            let id = this.client.nextId;
            this.messageHandlers[id] = resultHandler(resolve, reject);
            this.client.write({ op: "stacktrace", id, session: this.sessionId });
        })
    }

    private _createEvalOperationMessage(code: string, ns: string, opts: any) {
        if (vscode.debug.activeDebugSession && this.replType === 'clj') {
            const debugResponse = getStateValue(debug.DEBUG_RESPONSE_KEY);
            state.analytics().logEvent(debug.DEBUG_ANALYTICS.CATEGORY, debug.DEBUG_ANALYTICS.EVENT_ACTIONS.EVALUATE_IN_DEBUG_CONTEXT).send();
            return {
                id: debugResponse.id,
                session: this.sessionId,
                op: 'debug-input',
                input: `{:response :eval, :code ${code}}`,
                key: debugResponse.key,
                ...opts,
            };
        } else {
            return {
                id: this.client.nextId,
                op: 'eval',
                session: this.sessionId,
                code,
                ...opts
            };
        }
    }

    eval(code: string, ns: string, opts: { line?: number, column?: number, eval?: string, file?: string, stderr?: (x: string) => void, stdout?: (x: string) => void, stdin?: () => Promise<string>, pprintOptions: PrettyPrintingOptions } = { pprintOptions: disabledPrettyPrinter }) {
        const pprintOptions = opts.pprintOptions;
        opts["pprint"] = pprintOptions.enabled;
        delete opts.pprintOptions;
        const extraOpts = getServerSidePrinter(pprintOptions);
        const opMsg = this._createEvalOperationMessage(code, ns, { ...extraOpts, ...opts });

        let evaluation = new NReplEvaluation(opMsg.id, this, opts.stderr, opts.stdout, opts.stdin, new Promise((resolve, reject) => {
            this.messageHandlers[opMsg.id] = (msg) => {
                evaluation.setHandlers(resolve, reject);
                if (opts.line && opts.column && opts.file) {
                    debugDecorations.triggerUpdateAndRenderDecorations();
                }
                if (evaluation.onMessage(msg, pprintOptions)) {
                    return true;
                }
            }
            this.addRunningID(opMsg.id);
            this.client.write(opMsg);
        }));

        return evaluation;
    }

    interrupt(interruptId: string) {

        let index = this._runningIds.indexOf(interruptId);
        if (index > -1) {
            this._runningIds.splice(index, 1);
        }
        let id = this.client.nextId;
        return new Promise<void>((resolve, reject) => {
            this.messageHandlers[id] = resultHandler(resolve, reject);
            this.client.write({ op: "interrupt", session: this.sessionId, "interrupt-id": interruptId, id })
        });
    }

    stdin(message: string) {
        this.client.write({ op: "stdin", stdin: message, session: this.sessionId });
    }

    loadFile(file: string,
        opts: {
            fileName?: string,
            filePath?: string,
            stderr?: (x: string) => void,
            stdout?: (x: string) => void,
            pprintOptions: PrettyPrintingOptions
        } = {
                pprintOptions: disabledPrettyPrinter
            }) {

        let id = this.client.nextId;
        let evaluation = new NReplEvaluation(id, this, opts.stderr, opts.stdout, null, new Promise((resolve, reject) => {
            this.messageHandlers[id] = (msg) => {
                evaluation.setHandlers(resolve, reject);
                debugDecorations.triggerUpdateAndRenderDecorations();
                if (evaluation.onMessage(msg, opts.pprintOptions)) {
                    return true;
                }
            }
            this.addRunningID(id);
            this.client.write({ op: "load-file", session: this.sessionId, file, id, "file-name": opts.fileName, "file-path": opts.filePath })
        }))

        return evaluation;
    }

    complete(ns: string, symbol: string, context?: string) {
        return new Promise<any>((resolve, reject) => {
            const id = this.client.nextId,
                extraOpts = getConfig().enableJSCompletions ? { "enhanced-cljs-completion?": "t" } : {};
            this.messageHandlers[id] = resultHandler(resolve, reject);
            this.client.write({
                op: "complete",
                ns,
                symbol,
                id,
                session: this.sessionId,
                context,
                ...extraOpts
            });
        });
    }

    info(ns: string, symbol: string) {
        return new Promise<any>((resolve, reject) => {
            let id = this.client.nextId;
            this.messageHandlers[id] = resultHandler(resolve, reject);
            this.client.write({ op: "info", ns, symbol, id, session: this.sessionId })
        })
    }

    classpath() {
        return new Promise<any>((resolve, reject) => {
            let id = this.client.nextId;
            this.messageHandlers[id] = resultHandler(resolve, reject);
            this.client.write({ op: "classpath", id, session: this.sessionId })
        })
    }

    test(ns: string, test: string): Promise<cider.TestResults> {
        return new Promise<any>((resolve, reject) => {
            const id = this.client.nextId;
            this.messageHandlers[id] = resultHandler(resolve, reject);
            this.client.write({
                op: "test-var-query",
                ns,
                id,
                session: this.sessionId,
                "var-query": {
                    "ns-query": {
                        exactly: [ns]
                    },
                    search: test,
                    "search-property": "name"
                }
            });
        });
    }

    testNs(ns: string) {
        return new Promise<cider.TestResults>((resolve, reject) => {
            let id = this.client.nextId;
            this.messageHandlers[id] = resultHandler(resolve, reject);
            this.client.write({
                op: "test-var-query", ns, id, session: this.sessionId, "var-query": {
                    "ns-query": {
                        exactly: [ns]
                    }
                }
            });
        })
    }

    testAll() {
        return new Promise<cider.TestResults>((resolve, reject) => {
            let id = this.client.nextId;
            this.messageHandlers[id] = resultHandler(resolve, reject);
            this.client.write({ op: "test-all", id, session: this.sessionId, "load?": true });
        })
    }

    retest() {
        return new Promise<cider.TestResults>((resolve, reject) => {
            let id = this.client.nextId;
            this.messageHandlers[id] = resultHandler(resolve, reject);
            this.client.write({ op: "retest", id, session: this.sessionId });
        })
    }

    loadAll() {
        return new Promise<any>((resolve, reject) => {
            let id = this.client.nextId;
            this.messageHandlers[id] = resultHandler(resolve, reject);
            this.client.write({ op: "ns-load-all", id, session: this.sessionId });
        })
    }

    listNamespaces(regexps: string[]) {
        return new Promise<any>((resolve, reject) => {
            let id = this.client.nextId;
            this.messageHandlers[id] = resultHandler(resolve, reject);
            this.client.write({ op: "ns-list", id, session: this.sessionId, "filter-regexps": regexps });
        })
    }

    nsPath(ns: string) {
        return new Promise<any>((resolve, reject) => {
            let id = this.client.nextId;
            this.messageHandlers[id] = resultHandler(resolve, reject);
            this.client.write({ op: "ns-path", id, ns, session: this.sessionId });
        })
    }

    private _refresh(cmd, opts: { dirs?: string[], before?: string[], after?: string[] } = {}) {
        return new Promise<any>((resolve, reject) => {
            let id = this.client.nextId;
            let reloaded = [];
            let error, errorNs, status, err = "";
            this.messageHandlers[id] = (msg) => {
                if (msg.reloading)
                    reloaded = msg.reloading;
                if (hasStatus(msg, "ok"))
                    status = "ok";
                if (hasStatus(msg, "error")) {
                    status = "error";
                    error = msg.error;
                    errorNs = msg["error-ns"];
                }
                if (msg.err)
                    err += msg.err
                if (hasStatus(msg, "done")) {
                    let res = { reloaded, status } as any;
                    if (error) res.error = error;
                    if (errorNs) res.errorNs = errorNs;
                    if (err) res.err = err;
                    resolve(res)
                    return true;
                }
            }
            this.client.write({ op: cmd, id, session: this.sessionId, ...opts })
        })
    }

    refresh(opts: { dirs?: string[], before?: string[], after?: string[] } = {}) {
        return this._refresh("refresh", opts);
    }

    refreshAll(opts: { dirs?: string[], before?: string[], after?: string[] } = {}) {
        return this._refresh("refresh-all", opts);
    }

    formatCode(code: string, options?: string) {
        return new Promise<any>((resolve, reject) => {
            let id = this.client.nextId;
            this.messageHandlers[id] = resultHandler(resolve, reject);
            this.client.write({ op: "format-code", code, options })
        });
    }

    interruptAll(): number {
        if (this._runningIds.length > 0) {
            let ids: Array<string> = [];
            this._runningIds.forEach((id, index) => {
                ids.push(id);
            });
            this._runningIds = [];
            ids.forEach((id, index) => {
                this.interrupt(id)
                    .catch((e) => {

                    });
            });
            return (ids.length);
        }
        return (0);
    }

    initDebugger(): void {
        const id = this.client.nextId;
        // init-debugger op does not return immediately, but a response will be sent with the same id when a breakpoint is hit later
        this.client.write({ op: "init-debugger", id, session: this.sessionId });
    }

    sendDebugInput(input: any, debugResponseId: string, debugResponseKey: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {

            this.messageHandlers[debugResponseId] = resultHandler(resolve, reject);

            const data: any = {
                id: debugResponseId,
                op: 'debug-input',
                input,
                key: debugResponseKey,
                session: this.sessionId
            };

            this.client.write(data);
        });
    }

    listDebugInstrumentedDefs(): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            let id = this.client.nextId;
            this.messageHandlers[id] = resultHandler(resolve, reject);
            this.client.write({ op: 'debug-instrumented-defs', id, session: this.sessionId });
        });
    }

    clojureDocsRefreshCache() {
        return new Promise<any>((resolve, reject) => {
            let id = this.client.nextId;
            this.messageHandlers[id] = (msg) => {
                resolve(msg);
                return true;
            }
            this.client.write({ op: "clojuredocs-refresh-cache", id, session: this.sessionId });
        })
    }

    clojureDocsLookup(ns: string, symbol: string) {
        return new Promise<any>((resolve, reject) => {
            let id = this.client.nextId;
            this.messageHandlers[id] = (msg) => {
                resolve(msg);
                return true;
            }
            this.client.write({ op: "clojuredocs-lookup", id, ns, session: this.sessionId, sym: symbol });
        })
    }
}

/**
 * A running nREPL eval call.
 */
export class NReplEvaluation {

    private static Instances: Array<NReplEvaluation> = [];

    private _ns: string;

    private _msgValue: any;

    private _pprintOut: string;

    private _outPut: String;

    private _errorOutput: String;

    private _exception: String;

    private _stacktrace: any;

    private _msgs: any[] = [];

    private _interrupted: boolean = false;

    private _finished: boolean = false;

    private _running: boolean = false;

    private _resolve: (reason?: any) => void;

    private __reject: (reason?: any) => void;

    constructor(
        public id: string,
        public session: NReplSession,
        public stderr: (x: string) => void,
        public stdout: (x: string) => void,
        public stdin: () => Promise<string>,
        public value: Promise<any>) {
    }

    private add(): void {
        if (!NReplEvaluation.Instances.includes(this)) {
            NReplEvaluation.Instances.push(this);
        }
    }

    private remove(): void {
        let index = NReplEvaluation.Instances.indexOf(this, 0);
        if (index > -1) {
            NReplEvaluation.Instances.splice(index, 1);
        }
    }

    private doResolve(reason?: any) {
        if (this._resolve && !this.finished) {
            this._resolve(reason);
        }
        this._running = false;
        this._finished = true;
    }

    private doReject(reason?: any) {
        if (this.__reject && !this.finished) {
            this.__reject(reason);
        }
        this._running = false;
        this._finished = true;
    }

    get interrupted() {
        return (this._interrupted);
    }

    get running() {
        return (this._running);
    }

    get finished() {
        return (this._finished);
    }

    get ns() {
        return (this._ns);
    }

    get msgValue() {
        if (this._msgValue) {
            return (this._msgValue);
        }
        return ("");
    }

    get pprintOut() {
        return (this._pprintOut);
    }

    get hasException() {
        if (this._exception) {
            return (true)
        }
        return (false);
    }

    get exception() {
        return (this._exception);
    }

    get stacktrace() {
        return (this._stacktrace);
    }

    get msgs() {
        return (this._msgs);
    }

    get outPut() {
        return (this._outPut);
    }

    out(message: string) {
        if (!this._outPut) {
            this._outPut = message;
        } else {
            this._outPut += message;
        }
        if (this.stdout && !this.interrupted) {
            this.stdout(message);
        }
    }

    get errorOutput() {
        return (this._errorOutput);
    }

    err(message: string) {
        if (!this.errorOutput) {
            this._errorOutput = message;
        } else {
            this._errorOutput += message;
        }
        if (this.stderr && !this.interrupted) {
            this.stderr(message);
        }
    }

    in(message: string) {
        this.session.stdin(message);
    }

    interrupt() {
        if (!this.interrupted && this.running) {
            this.remove();
            this._interrupted = true;
            this._exception = "Evaluation was interrupted";
            this._stacktrace = {};
            this.session.interrupt(this.id).catch(() => { });
            this.doReject(this.exception);
            // make sure the message handler is removed.
            delete this.session.messageHandlers[this.id];
        }
    }

    setHandlers(resolve: (reason?: any) => void, reject: (reason?: any) => void) {
        this._resolve = resolve;
        this.__reject = reject;
    }

    onMessage(msg: any, pprintOptions: PrettyPrintingOptions): boolean {
        this._running = true;
        this.add();
        if (msg) {
            this._msgs.push(msg);
            if (msg.out) {
                this.out(msg.out)
            }
            if (msg.err && this.msgValue !== debug.DEBUG_QUIT_VALUE) {
                this.err(msg.err)
            }
            if (msg.ns) {
                this._ns = msg.ns;
            }
            if (msg.ex) {
                this._exception = msg.ex;
            }
            // cider-nrepl debug middleware eval error (eval error occurred during debug session)
            if (hasStatus(msg, 'eval-error') && msg.causes) {
                const cause = msg.causes[0];
                const errorMessage = `${cause.class}: ${cause.message}`;
                this._stacktrace = { stacktrace: cause.stacktrace };
                this.err(errorMessage);
            }
            if (msg.value !== undefined || msg['debug-value'] !== undefined) {
                this._msgValue = msg.value || msg['debug-value'];
            }
            if (msg["pprint-out"]) {
                this._pprintOut = msg["pprint-out"];
            }
            if (msg.status && msg.status == "need-input") {
                if (this.stdin) {
                    this.stdin().then((line) => {
                        let input = String(line).trim();
                        this.session.stdin(`${input}\n`);
                    }).catch((reason) => {
                        this.err("Failed to retrieve input: " + reason);
                        this.session.stdin('\n');
                    })
                } else {
                    util.promptForUserInputString("REPL Input:")
                        .then(input => {
                            if (input !== undefined) {
                                this.session.stdin(`${input}\n`);
                            } else {
                                this.out("Sending interrupt.");
                                this.interrupt();
                            }
                        }).catch((e) => {
                            this.session.stdin('\n');
                        });
                }
            }
            if (hasStatus(msg, 'done') || hasStatus(msg, 'need-debug-input')) {
                this.remove();
                if (this.exception && this.msgValue !== debug.DEBUG_QUIT_VALUE) {
                    this.session.stacktrace().then((stacktrace) => {
                        this._stacktrace = stacktrace;
                        this.doReject(this.exception);
                    }).catch(() => { });
                } else if (this.pprintOut) {
                    this.doResolve(this.pprintOut)
                } else if (this.stacktrace) {
                    // No exception but stacktrace means likely debug eval error. Error will have been printed already from call to this.err(),
                    // so just reject with no value so that just the stacktrace is printed.
                    this.doReject('');
                } else {
                    let printValue = this.msgValue;
                    if (pprintOptions.enabled && pprintOptions.printEngine === 'calva') {
                        const pretty = prettyPrint(this.msgValue, pprintOptions);
                        if (!pretty.error) {
                            printValue = pretty.value;
                        } else {
                            this.err(pretty.error);
                        }
                    }
                    this.doResolve(printValue);
                }
                return true;
            }
        }
        return false;
    }

    static interruptAll(stderr: (x: string) => void): number {
        let num = 0;
        let items: Array<NReplEvaluation> = [];
        NReplEvaluation.Instances.forEach((item, index) => {
            items.push(item);
        });
        items.forEach((item, index) => {
            if (!item.interrupted && !item.finished) {
                num++;
                try {
                    item.interrupt();
                } catch (e) {
                    if (stderr) {
                        stderr("Error interrupting evaluation: " + e);
                    }
                }
            }
        });
        return (num);
    }
}
