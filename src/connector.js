const vscode = require('vscode');
const _ = require('lodash');
const find = require('find');
const fs = require('fs');
const state = require('./state');
const repl = require('./repl/client');
const message = require('./repl/message');
const util = require('./utilities');
const status = require('./status');
const terminal = require('./terminal');
const evaluate = require('./repl/middleware/evaluate');

function disconnect(options = null, callback = () => { }) {
    let chan = state.deref().get('outputChannel'),
        connections = 0;

    if (util.getSession("clj")) {
        connections++;
        let client = repl.create(options).once('connect', () => {
            client.send(message.close(util.getSession("clj")), () => {
                connections--;
                state.cursor.set('clj', null);
                chan.appendLine("Disconnected CLJ session");
                client.end();
                if (connections == 0) {
                    callback();
                }
            });
        });
    }
    if (util.getSession("cljs")) {
        connections++;
        let client = repl.create(options).once('connect', () => {
            client.send(message.close(util.getSession("cljs")), () => {
                connections--;
                state.cursor.set('cljs', null)
                chan.appendLine("Disconnected CLJS session");
                client.end();
                if (connections == 0) {
                    callback();
                }
            });
        });
    }

    if (connections == 0) {
        state.cursor.set("connected", false);
        state.cursor.set('cljc', null);
        status.update();
        callback();
    }
}

function connectToHost(hostname, port) {
    let chan = state.deref().get('outputChannel');

    disconnect({ hostname, port }, () => {
        state.cursor.set('connecting', true);
        status.update();

        chan.appendLine("Hooking up nREPL sessions...");

        let client = repl.create({
            hostname,
            port
        }).once('connect', () => {
            client.send(message.clone(), cloneResults => {
                let newSession = _.find(cloneResults, 'new-session')['new-session'];

                if (newSession) {
                    client.end();
                    listSessions(hostname, port, sessions => {
                        findSession(hostname, port, sessions.length - 1, sessions);
                    });
                } else {
                    chan.appendLine("Failed cloning while connecting to a nrepl session.");
                }
            });
        });
    });
};

function listSessions(hostname, port, callback) {
    let client = repl.create({ hostname, port }).once('connect', () => {
        client.send(message.listSessions(), results => {
            client.end();
            callback(results[0].sessions);
        });
    });
}

function findSession(hostname, port, session, sessions) {
    let current = state.deref(),
        chan = current.get('outputChannel');

    let client = repl.create({ hostname, port })
        .once('connect', () => {
            let msg = message.checkSessionType(sessions[session]);
            client.send(msg, (results) => {
                let exResult = _.find(results, 'ex'),
                    valueResult = _.find(results, 'value');
                if (exResult) {
                    if (!util.getSession("clj")) {
                        state.cursor.set("clj", sessions[session]);
                        state.cursor.set("cljc", sessions[session]);
                        chan.appendLine("Connected session: clj");
                        chan.appendLine('cljc files will use the clj REPL. (You can toggle this, if a cljs REPL is available)');
                        terminal.createREPLTerminal('clj', chan);
                    }
                } else if (valueResult && valueResult.value === "3.14") {
                    if (!util.getSession("cljs")) {
                        state.cursor.set("cljs", sessions[session]);
                        chan.appendLine("Connected session: cljs");
                        terminal.createREPLTerminal('cljs', chan);
                    }
                }
                client.end();
            });
        })
        .once('end', () => {
            //If last session, check if found
            if (session > 0 &&
                (util.getSession("clj") === null || util.getSession("cljs") === null)) {
                findSession(hostname, port, session - 1, sessions);
            } else if (util.getSession('clj') || util.getSession('cljs')) {
                state.cursor.set("connected", true);
                state.cursor.set("connecting", false);
                evaluate.evaluateFile();
            } else {
                state.cursor.set("connected", false);
                state.cursor.set("connecting", false);
                chan.appendLine("Failed connecting. Calva needs a REPL started before it can connect.");
            }
            status.update();
        });
};

function connect() {
    let path = vscode.workspace.rootPath;

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

    return new Promise((resolve, reject) => {
        find.eachfile(/\.nrepl-port$/, path, (file) => {
            fs.readFile(file, 'utf8', (err, data) => {
                if (!err) {
                    let hostname = "localhost",
                        port = parseFloat(data);

                    state.cursor.set("hostname", hostname);
                    state.cursor.set("port", port);
                    connectToHost(hostname, port);
                    resolve();
                }
                else {
                    reject(err);
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
    disconnect,
    reconnect,
    autoConnect,
    toggleCLJCSession
};
