import * as net from "net";
import { BEncoderStream, BDecoderStream } from "./bencode";
import * as state from './../state';
import * as replWindow from './../repl-window';

/** An nRREPL client */
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

    ns: string = "user";

    private constructor(socket: net.Socket) {
        this.socket = socket;
        this.socket.on("error", e => {
            console.error(e);
            state.connectionLogChannel().appendLine(e.message);
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
        this.encoder.write(data)
    }

    close() {
        this.socket.destroy();
    }

    /**
     * Create a new NRepl client
     */
    static create(opts: { host: string, port: number }) {
        return new Promise<NReplClient>((resolve, reject) => {

            let socket = net.createConnection(opts, () => {

                let nsId = client.nextId
                let cloneId = client.nextId;
                let describeId = client.nextId;

                client.decoder.on("data", data => {
                    //console.log("-> ", data);
                    if (!client.describe && data["id"] == describeId) {
                        client.describe = data;
                    } else if (data["id"] == nsId) {
                        if (data["ns"])
                            client.ns = data["ns"]
                        if (data["status"] && data["status"].indexOf("done") != -1)
                            client.encoder.write({ "op": "clone", "id": cloneId });
                    } else if (data["id"] == cloneId) {
                        client.session = new NReplSession(data["new-session"], client)
                        client.encoder.write({ "op": "describe", id: describeId, verbose: true, session: data["new-session"] });
                        resolve(client)
                    } else if (data["session"]) {
                        let session = client.sessions[data["session"]];
                        if (session)
                            session._response(data);
                    }
                })
                client.encoder.write({ "op": "eval", code: "*ns*", "id": nsId });

            });
            let client = new NReplClient(socket);
        });
    }
}

export class NReplSession {
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
    }

    messageHandlers: { [id: string]: (msg: any) => boolean } = {};
    replType: "clj" | "cljs" = null;

    close() {
        this.client.write({ op: "close", session: this.sessionId })
        delete this.client.sessions[this.sessionId]
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

        const msgValue: string = msgData.out || msgData.err;
        const msgType: string = msgData.out? "stdout" : "stderr";

        if (msgValue && this.replType) {
            const window = replWindow.getReplWindow(this.replType);
            const windowMsg = {
                type: msgType,
                value: msgValue
            };

            const outputChan = state.config().asyncOutputDestination;

            if (outputChan == "REPL Window") {
                window.postMessage(windowMsg);
            } else if (outputChan == "Calva says") {
                state.outputChannel().appendLine(msgValue.replace(/\n\r?$/, ""));
            } else if (outputChan == "Both") {
                window.postMessage(windowMsg);
                state.outputChannel().appendLine(msgValue.replace(/\n\r?$/, ""));
            }
        }
    }

    _response(data: any) {
        if (this.messageHandlers[data.id]) {
            let res = this.messageHandlers[data.id](data);
            if (res)
                delete this.messageHandlers[data.id];
        } else {
            this._defaultMessageHandler(data).then(() => {}, () => {});
        }
    }

    describe(verbose?: boolean) {
        return new Promise<any>((resolve, reject) => {
            let id = this.client.nextId;
            this.messageHandlers[id] = (msg) => {
                resolve(msg);
                return true;
            }
            this.client.write({ op: "describe", id: id, session: this.sessionId, verbose });
        })
    }

    listSessions() {
        return new Promise<any>((resolve, reject) => {
            let id = this.client.nextId;
            this.messageHandlers[id] = (msg) => {
                resolve(msg);
                return true;
            }
            this.client.write({ op: "ls-sessions", id: id, session: this.sessionId });
        })
    }

    stacktrace() {
        return new Promise<any>((resolve, reject) => {
            let id = this.client.nextId;
            this.messageHandlers[id] = (msg) => {
                resolve(msg);
                return true;
            }
            this.client.write({ op: "stacktrace", id, session: this.sessionId })
        })
    }

    eval(code: string, opts: { line?: number, column?: number, eval?: string, file?: string, stderr?: (x: string) => void, stdout?: (x: string) => void, pprint?: boolean } = {}) {
        const id = this.client.nextId,
            pprintOpts = opts.pprint ? {
                "nrepl.middleware.print/print": "cider.nrepl.pprint/puget-pprint",
                "nrepl.middleware.print/options": {
                    "width": 120,
                }
            } : {};

        let evaluation = new NReplEvaluation(id, this, opts.stderr, opts.stdout, new Promise((resolve, reject) => {
            let ex;
            let value;
            this.messageHandlers[id] = (msg) => {
                if (msg.out)
                    evaluation.out(msg.out)
                if (msg.err)
                    evaluation.err(msg.err)
                if (msg.ns)
                    evaluation.ns = msg.ns;
                if (msg.ex) {
                    ex = msg.ex;
                    setTimeout(() => {
                        reject(ex);
                    }, 1000);
                }
                if (msg.value != undefined)
                    value = msg.value
                if (msg["pprint-out"])
                    evaluation.pprintOut = msg["pprint-out"];
                if (msg.status && msg.status == "done") {
                    if (ex)
                        reject(ex);
                    else if (value)
                        resolve(value);
                    else if (evaluation.pprintOut)
                        resolve(evaluation.pprintOut)
                    else
                        resolve("");
                    return true;
                }
                if (msg.status && msg.status == "need-input") {
                    resolve("user input is not yet supported in Calva");
                    this.stdin("\n");
                    return true;
                }
            }
            const opMsg = { op: "eval", session: this.sessionId, code, id, ...pprintOpts, ...opts };
            this.client.write(opMsg);
        }))

        return evaluation;
    }

    interrupt(interruptId: string) {
        let id = this.client.nextId;
        return new Promise<void>((resolve, reject) => {
            this.messageHandlers[id] = (msg) => {
                resolve();
                return true;
            }
            this.client.write({ op: "interrupt", session: this.sessionId, "interrupt-id": interruptId, id })
        });
    }

    stdin(message: string) {
        this.client.write({ op: "stdin", stdin: message, session: this.sessionId });
    }

    loadFile(file: string, opts: { fileName?: string, filePath?: string, stderr?: (x: string) => void, stdout?: (x: string) => void } = {}) {
        
        let id = this.client.nextId;
        let evaluation = new NReplEvaluation(id, this, opts.stderr, opts.stdout, new Promise((resolve, reject) => {
            this.messageHandlers[id] = (msg) => {
                if (msg.value)
                    resolve(msg.value);
                if (msg.out)
                    evaluation.out(msg.out)
                if (msg.err)
                    evaluation.out(msg.err)
                if (msg.ex) {
                    this.stacktrace().then(ex => reject(ex)).catch(reason => {
                        console.error("Problems processing the stack trace: ", reason);
                    });
                }
                if (msg.status && msg.status.indexOf("done") != -1)
                    return true;
            }
            this.client.write({ op: "load-file", session: this.sessionId, file, id, "file-name": opts.fileName, "file-path": opts.filePath })
        }))

        return evaluation;
    }

    complete(ns: string, symbol: string, context?: string) {
        return new Promise<any>((resolve, reject) => {
            let id = this.client.nextId;
            this.messageHandlers[id] = (msg) => {
                resolve(msg);
                return true;
            }
            this.client.write({ op: "complete", ns, symbol, id, session: this.sessionId, context })
        })
    }

    info(ns: string, symbol: string) {
        return new Promise<any>((resolve, reject) => {
            let id = this.client.nextId;
            this.messageHandlers[id] = (msg) => {
                resolve(msg);
                return true;
            }
            this.client.write({ op: "info", ns, symbol, id, session: this.sessionId })
        })
    }

    test(ns: string, tests?: string[]) {
        return new Promise<any>((resolve, reject) => {
            let id = this.client.nextId;
            this.messageHandlers[id] = (msg) => {
                resolve(msg);
                return true;
            }
            this.client.write({
                op: "test", ns, id, session: this.sessionId, "tests": tests, "load?": true
            });
        })
    }

    testNs(ns: string) {
        return new Promise<any>((resolve, reject) => {
            let id = this.client.nextId;
            this.messageHandlers[id] = (msg) => {
                resolve(msg);
                return true;
            }
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
        return new Promise<any>((resolve, reject) => {
            let id = this.client.nextId;
            this.messageHandlers[id] = (msg) => {
                resolve(msg);
                return true;
            }
            this.client.write({ op: "test-all", id, session: this.sessionId, "load?": true });
        })
    }

    retest() {
        return new Promise<any>((resolve, reject) => {
            let id = this.client.nextId;
            this.messageHandlers[id] = (msg) => {
                resolve(msg);
                return true;
            }
            this.client.write({ op: "retest", id, session: this.sessionId });
        })
    }

    loadAll() {
        return new Promise<any>((resolve, reject) => {
            let id = this.client.nextId;
            this.messageHandlers[id] = (msg) => {
                resolve(msg);
                return true;
            }
            this.client.write({ op: "ns-load-all", id, session: this.sessionId });
        })
    }

    listNamespaces(regexps: string[]) {
        return new Promise<any>((resolve, reject) => {
            let id = this.client.nextId;
            this.messageHandlers[id] = (msg) => {
                resolve(msg);
                return true;
            }
            this.client.write({ op: "ns-list", id, session: this.sessionId, "filter-regexps": regexps });
        })
    }

    nsPath(ns: string) {
        return new Promise<any>((resolve, reject) => {
            let id = this.client.nextId;
            this.messageHandlers[id] = (msg) => {
                resolve(msg);
                return true;
            }
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
                if (msg.status && msg.status.indexOf("ok") != -1)
                    status = "ok";
                if (msg.status && msg.status.indexOf("error") != -1) {
                    status = "error";
                    error = msg.error;
                    errorNs = msg["error-ns"];
                }
                if (msg.err)
                    err += msg.err
                if (msg.status && msg.status.indexOf("done") != -1) {
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
            this.messageHandlers[id] = (msg) => {
                resolve(msg);
                return true;
            }
            this.client.write({ op: "format-code", code, options })
        })

    }
}

/**
 * A running nREPL eval call.
 */
export class NReplEvaluation {
    constructor(public id: string, public session: NReplSession, public stderr: (x: string) => void, public stdout: (x: string) => void, public value: Promise<any>) {
    }

    ns: string;

    pprintOut: string;

    out(message: string) {
        if (this.stdout)
            this.stdout(message);
    }

    err(message: string) {
        if (this.stderr)
            this.stderr(message);
    }

    in(message: string) {
        this.session.stdin(message);
    }

    interrupt() {
        return this.session.interrupt(this.id);
    }
}