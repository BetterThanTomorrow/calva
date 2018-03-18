const vscode = require('vscode');
const find = require('find');
const fs = require('fs');
const state = require('./state');
const statusbar = require('./statusbar');
const repl = require('./repl/client');
const message = require('./repl/message');
const utilities = require('./utilities');

function connectToHost(hostname, port) {
    let client = repl.create({
        hostname,
        port
    }).once('connect', () => {
        state.cursor.set("connected", true);
        let msg = message.listSessions();
        client.send(msg, (results) => {
            findSession(0, results[0].sessions);
            client.end();
        });
    });
}

function findSession(session, sessions) {
    let current = state.deref();
    let client = repl.create()
        .once('connect', () => {
            let msg = message.testSession(sessions[session]);
            client.send(msg, (results) => {
                for (var i = 0; i < results.length; i++) {
                    let result = results[i];
                    if (result.value && result.value === "3.14" && current.get("cljs") === null) {
                        state.cursor.set("cljs", sessions[session]);
                    } else if (result.ex && current.get("clj") === null) {
                        state.cursor.set("clj", sessions[session]);
                        state.cursor.set("cljc", sessions[session]);
                    }
                }
                client.end();
            });
        })
        .once('end', () => {
            //If last session, check if found
            if (session === (sessions.length - 1) && current.get("cljs") === null) {
                //Default to first session if no cljs-session is found, and treat it as a clj-session
                if (sessions.length > 0) {
                    state.cursor.set("clj", sessions[session]);
                    state.cursor.set("cljc", sessions[session]);
                }
            } else if ((session + 1) <= (sessions.length - 1) &&
                (current.get("cljs") === null || current.get("clj") === null)) {
                findSession((session + 1), sessions);
            } else {
                //Check the initial file where the command is called from
                //TODO FIXME -clojureEvaluation.evaluateFile(state);
            }
            statusbar.update();
        });
};

function connect() {
    let path = vscode.workspace.rootPath;
    new Promise((resolve, reject) => {
        find.file(/\.nrepl-port$/, path, (files) => {
            if (files.length > 0) {
                fs.readFile(files[0], 'utf8', (err, data) => {
                    if (!err) {
                        resolve(data);
                    } else {
                        reject("");
                    }
                });
            } else {
                reject("");
            }
        });
    }).then((port) => {
        vscode.window.showInputBox({
            placeHolder: "Enter existing nREPL hostname:port here...",
            prompt: "Add port to nREPL if localhost, otherwise 'hostname:port'",
            value: "localhost:" + port,
            ignoreFocusOut: true
        })
            .then(function (url) {
                let [hostname, port] = url.split(':');
                state.cursor.set("hostname", hostname);
                state.cursor.set("port", port);
                connectToHost(hostname, port);
            });
    });
};

function reconnect() {
    state.reset();
    autoConnect();
};

function autoConnect() {
    let path = vscode.workspace.rootPath;
    return new Promise((resolve, _) => {
        find.file(/\.nrepl-port$/, path, (files) => {
            if (files.length > 0) {
                fs.readFile(files[0], 'utf8', (err, data) => {
                    if (!err) {
                        let hostname = "localhost",
                            port = parseFloat(data);

                        state.cursor.set("hostname", hostname);
                        state.cursor.set("port", port);
                        connectToHost(hostname, port);
                    }
                });
            }
        });
    });
};

function toggleCLJCSession() {
    let current = state.deref();

    if (current.get('connected')) {
        if (current.get('cljc') == current.get('cljs')) {
            state.cursor.set('cljc', current.get('clj'));
        } else if (current.get('cljc') == current.get('clj')) {
            state.cursor.set('cljc', current.get('cljs'));
        }
        statusbar.update();
    }
}
module.exports = {
    connect,
    reconnect,
    autoConnect,
    toggleCLJCSession
};
