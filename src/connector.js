const vscode = require('vscode');
const find = require('find');
const fs = require('fs');
const state = require('./state');
const statusbar = require('./statusbar');
const repl = require('./repl/client');
const message = require('./repl/message');
const util = require('./utilities');
const status = require('./status');
const terminal = require('./terminal');
const evaluate = require('./repl/middleware/evaluate');

function connectToHost(hostname, port) {
    let current = state.deref(),
        chan = state.deref().get('outputChannel');

    state.cursor.set('clj', null);
    state.cursor.set('cljs', null);
    state.cursor.set('cljc', null);

    chan.appendLine("Hooking up nREPL sessions...");

    let client = repl.create({
        hostname,
        port
    }).once('connect', () => {
        state.cursor.set("connected", true);
        state.cursor.set("connecting", false);
        let msg = message.listSessions();
        client.send(msg, (results) => {
            findSession(0, results[0].sessions);
            client.end();
        });
    });
};

function findSession(session, sessions) {
    let current = state.deref(),
        chan = current.get('outputChannel');

    let client = repl.create()
        .once('connect', () => {
            let msg = message.testSession(sessions[session]);
            client.send(msg, (results) => {
                for (var i = 0; i < results.length; i++) {
                    let result = results[i];
                    if (result.ex) {
                        if (!util.getSession("clj")) {
                            state.cursor.set("clj", sessions[session]);
                            state.cursor.set("cljc", sessions[session]);
                            chan.appendLine("Connected session: clj");
                            chan.appendLine('cljc files will use the clj REPL. (You can toggle this, if a cljs REPL is available)');
                            terminal.createREPLTerminal('clj', chan);
                        }
                    } else if (result.value && result.value === "3.14") {
                        if (!util.getSession("cljs")) {
                            state.cursor.set("cljs", sessions[session]);
                            chan.appendLine("Connected session: cljs");
                            terminal.createREPLTerminal('cljs', chan);
                        }
                    }
                }
                client.end();
            });
        })
        .once('end', () => {
            //If last session, check if found
            if (session === (sessions.length - 1) && util.getSession("cljs") === null) {
                //Default to first session if no cljs-session is found, and treat it as a clj-session
                state.cursor.set("clj", sessions[session]);
                state.cursor.set("cljc", sessions[session]);
            } else if ((session + 1) <= (sessions.length - 1) &&
                (util.getSession("cljs") === null || util.getSession("clj") === null)) {
                findSession((session + 1), sessions);
            } else {
                evaluate.evaluateFile();
            }
            status.update();
        });
};

function connect() {
    let path = vscode.workspace.rootPath;

    state.cursor.set('connecting', true);
    status.update();

    new Promise((resolve, reject) => {
        find.eachfile(/\.nrepl-port$/, path, (file) => {
            fs.readFile(file, 'utf8', (err, data) => {
                if (!err) {
                    resolve(data);
                } else {
                    reject("");
                }
            });
        });
    }).then((port) => {
        vscode.window.showInputBox({
            placeHolder: "Enter existing nREPL hostname:port here...",
            prompt: "Add port to nREPL if localhost, otherwise 'hostname:port'",
            value: "localhost:" + port,
            ignoreFocusOut: true
        })
            .then(function (url) {
                // state.reset(); TODO see if this should be done
                let [hostname, port] = url.split(':');
                state.cursor.set("hostname", hostname);
                state.cursor.set("port", port);
                connectToHost(hostname, port);
            });
    }).catch(() => {
        state.cursor.set('connecting', false);
        status.update();
    });
};

function reconnect() {
    state.reset();
    connect();
};

function autoConnect() {
    let path = vscode.workspace.rootPath;

    return new Promise((resolve, _) => {
        find.eachfile(/\.nrepl-port$/, path, (file) => {
            fs.readFile(file, 'utf8', (err, data) => {
                if (!err) {
                    let hostname = "localhost",
                        port = parseFloat(data);

                    state.cursor.set("hostname", hostname);
                    state.cursor.set("port", port);
                    connectToHost(hostname, port);
                }
            });
        });
    });
};

function toggleCLJCSession() {
    let current = state.deref();

    if (current.get('connected')) {
        if (util.getSession('cljc') == util.getSession('cljs')) {
            state.cursor.set('cljc', util.getSession('clj'));
        } else if (util.getSession('cljc') == util.getSession('clj')) {
            state.cursor.set('cljc', util.getSession('cljs'));
        }
        status.update();
    }
}

module.exports = {
    connect,
    reconnect,
    autoConnect,
    toggleCLJCSession
};
