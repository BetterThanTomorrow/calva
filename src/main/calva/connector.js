import vscode from 'vscode';
import _ from 'lodash';
import fs from 'fs';
import { cursor, deref, reset } from './state';
import createReplClient from './repl/client';
import message from 'goog:calva.repl.message';
import { getProjectDir, getSession } from './utilities';
import { isShadowCljs, shadowBuilds, shadowNReplPortFile } from './shadow';
import updateStatus from './status';
import { createREPLTerminal } from './terminal';
//const evaluate = require('./repl/middleware/evaluate');

function nreplPortFile() {
    if (fs.existsSync(shadowNReplPortFile())) {
        return shadowNReplPortFile();
    }
    else {
        return getProjectDir() + '/.nrepl-port'
    }
}

function disconnect(options = null, callback = () => { }) {
    let chan = deref().get('outputChannel'),
        connections = [];


    ['clj', 'cljs'].forEach(sessionType => {
        if (getSession(sessionType)) {
            connections.push([sessionType, getSession(sessionType)]);
        }
        cursor.set(sessionType, null);
    });
    cursor.set("connected", false);
    cursor.set('cljc', null);
    updateStatus();

    let n = connections.length;
    if (n > 0) {
        let client = createReplClient(options).once('connect', () => {
            client.send(message.listSessionsMsg(), results => {
                client.end();
                let sessions = _.find(results, 'sessions')['sessions'];
                if (sessions) {
                    connections.forEach(connection => {
                        let sessionType = connection[0],
                            sessionId = connection[1]
                        if (sessions.indexOf(sessionId) != -1) {
                            let client = createReplClient(options).once('connect', () => {
                                client.send(message.closeMsg(sessionId), () => {
                                    client.end();
                                    n--;
                                    cursor.set(sessionType, null);
                                    chan.appendLine("Disconnected session: " + sessionType);
                                    if (n == 0) {
                                        callback();
                                    }
                                });
                            });
                        } else {
                            if (--n == 0) {
                                callback();
                            }
                        }
                    });
                } else {
                    callback();
                }
            });
        });
    } else {
        callback();
    }
}

function connectToHost(hostname, port) {
    let chan = deref().get('outputChannel');

    disconnect({ hostname, port }, () => {
        cursor.set('connecting', true);
        updateStatus();

        let onConnect = () => {
            chan.appendLine("Hooking up nREPL sessions...");

            client.send(message.cloneMsg(), cloneResults => {
                client.end();
                let cljSession = _.find(cloneResults, 'new-session')['new-session'];
                if (cljSession) {
                    cursor.set("clj", cljSession);
                    cursor.set("cljc", cljSession);
                    cursor.set("connected", true);
                    cursor.set("connecting", false);
                    updateStatus();
                    chan.appendLine("Connected session: clj");
                    createREPLTerminal('clj', null, chan);

                    makeCljsSessionClone(hostname, port, cljSession, null, (cljsSession, shadowBuild) => {
                        if (cljsSession) {
                            setUpCljsRepl(cljsSession, chan, shadowBuild);
                        }
                        chan.appendLine('cljc files will use the clj REPL.' + (cljsSession ? ' (You can toggle this at will.)' : ''));
                        //evaluate.evaluateFile();
                        updateStatus();
                    });
                } else {
                    cursor.set("connected", false);
                    cursor.set("connecting", false);
                    chan.appendLine("Failed connecting. (Calva needs a REPL started before it can connect.)");
                }
            });
        };

        let client = createReplClient({
            "host": hostname,
            "port": port,
            "on-connect": onConnect
        });
    });
}

function setUpCljsRepl(cljsSession, chan, shadowBuild) {
    cursor.set("cljs", cljsSession);
    chan.appendLine("Connected session: cljs");
    createREPLTerminal('cljs', shadowBuild, chan);
}

function makeCljsSessionClone(hostname, port, session, shadowBuild, callback) {
    let chan = deref().get('outputChannel');

    if (isShadowCljs() && !shadowBuild) {
        chan.appendLine("This looks like a shadow-cljs coding session.");
        vscode.window.showQuickPick(shadowBuilds(), {
            placeHolder: "Select which shadow-cljs build to connect to",
            ignoreFocusOut: true
        }).then(build => {
            if (build) {
                makeCljsSessionClone(hostname, port, session, build, callback);
            }
        });
    } else {
        let client = createReplClient({ hostname, port }).once('connect', () => {
            client.send(message.cloneMsg(session), results => {
                client.end();
                let cljsSession = _.find(results, 'new-session')['new-session'];
                if (cljsSession) {
                    let client = createReplClient({ hostname, port }).once('connect', () => {
                        let msg = shadowBuild ? message.startShadowCljsReplMsg(cljsSession, shadowBuild) : message.startCljsReplMsg(cljsSession);
                        client.send(msg, cljsResults => {
                            client.end();
                            let valueResult = _.find(cljsResults, 'value'),
                                nsResult = _.find(cljsResults, 'ns');
                            if (!shadowBuild && nsResult) {
                                cursor.set('shadowBuild', null);
                                callback(cljsSession);
                            } else if (shadowBuild && valueResult && valueResult.value.match(":selected " + shadowBuild)) {
                                cursor.set('shadowBuild', shadowBuild);
                                callback(cljsSession, shadowBuild);
                            } else {
                                if (shadowBuild) {
                                    let failed = `Failed starting cljs repl for shadow-cljs build: ${shadowBuild}`;
                                    cursor.set('shadowBuild', null);
                                    chan.appendLine(`${failed}. Is the build running and conected?`);
                                    console.error(failed, cljsResults);
                                } else {
                                    let failed = `Failed to start ClojureScript REPL with command: ${msg.code}`;
                                    console.error(failed, cljsResults);
                                    chan.appendLine(`${failed}. Is the app running in the browser and conected?`);
                                }
                                callback(null);
                            }
                        })
                    });
                } else {
                    let failed = `Failed to clone nREPL session for ClojureScript REPL`;
                    console.error(failed, results);
                    chan.appendLine(failed);
                    callback(null);
                }
            });
        });
    }
}

function promptForNreplUrlAndConnect(port) {
    let current = deref(),
        chan = current.get('outputChannel');

    vscode.window.showInputBox({
        placeHolder: "Enter existing nREPL hostname:port here...",
        prompt: "Add port to nREPL if localhost, otherwise 'hostname:port'",
        value: "localhost:" + (port ? port : ""),
        ignoreFocusOut: true
    }).then(function (url) {
        // state.reset(); TODO see if this should be done
        if (url !== undefined) {
            let [hostname, port] = url.split(':'),
                parsedPort = parseFloat(port);
            if (parsedPort && parsedPort > 0 && parsedPort < 65536) {
                cursor.set("hostname", hostname);
                cursor.set("port", parsedPort);
                connectToHost(hostname, parsedPort);
            } else {
                chan.appendLine("Bad url: " + url);
                cursor.set('connecting', false);
                updateStatus();
            }
        } else {
            cursor.set('connecting', false);
            updateStatus();
        }
    });
}

function connect(isAutoConnect = false) {
    let current = deref(),
        chan = current.get('outputChannel');

    new Promise((resolve, reject) => {
        if (fs.existsSync(nreplPortFile())) {
            fs.readFile(nreplPortFile(), 'utf8', (err, data) => {
                if (!err) {
                    resolve(parseFloat(data));
                } else {
                    reject(err);
                }
            });
        } else {
            resolve(null);
        }
    }).then((port) => {
        if (port) {
            if (isAutoConnect) {
                cursor.set("hostname", "localhost");
                cursor.set("port", port);
                connectToHost("localhost", port);
            } else {
                promptForNreplUrlAndConnect(port);
            }
        } else {
            chan.appendLine('No nrepl port file found. (Calva does not start the nrepl for you, yet.) You might need to adjust "calva.projectRootDirectory" in Workspace Settings.');
            promptForNreplUrlAndConnect(port);
        }
    }).catch((err) => {
        chan.appendLine("Error reading nrepl port file: " + err);
        promptForNreplUrlAndConnect(null);
    });
}

function reconnect() {
    reset();
    connect(true);
}

function autoConnect() {
    connect(true);
}

function toggleCLJCSession() {
    let current = deref();

    if (current.get('connected')) {
        if (getSession('cljc') == getSession('cljs')) {
            cursor.set('cljc', getSession('clj'));
        } else if (getSession('cljc') == getSession('clj')) {
            cursor.set('cljc', getSession('cljs'));
        }
        updateStatus();
    }
}

function recreateCljsRepl() {
    let current = deref(),
        cljSession = getSession('clj'),
        chan = current.get('outputChannel'),
        hostname = current.get('hostname'),
        port = current.get('port');

    makeCljsSessionClone(hostname, port, cljSession, null, (session, shadowBuild) => {
        if (session) {
            setUpCljsRepl(session, chan, shadowBuild);
        }
        updateStatus();
    })
}

export {
    connect,
    disconnect,
    reconnect,
    autoConnect,
    toggleCLJCSession,
    recreateCljsRepl
};
