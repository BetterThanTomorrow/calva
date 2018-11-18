import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as fs from 'fs';
import * as state from './state';
import * as util from './utilities';
import shadow from './shadow';
import status from './status';
import terminal from './terminal';
import repl from './repl/client';
import * as calvaLib from '../lib/calva';

function nreplPortFile() {
    if (fs.existsSync(shadow.shadowNReplPortFile())) {
        return shadow.shadowNReplPortFile();
    }
    else {
        return util.getProjectDir() + '/.nrepl-port'
    }
}

function disconnect(options = null, callback = () => { }) {
    let chan = state.deref().get('outputChannel'),
        connections = [];

    if (!options) {
        options = repl.getDefaultOptions();
    }


    ['clj', 'cljs'].forEach(sessionType => {
        if (util.getSession(sessionType)) {
            connections.push([sessionType, util.getSession(sessionType)]);
        }
        state.cursor.set(sessionType, null);
    });
    state.cursor.set("connected", false);
    state.cursor.set('cljc', null);
    status.update();

    let n = connections.length;
    if (n > 0) {
        let client = calvaLib.nrepl_create(options).once('connect', () => {
            client.send(calvaLib.message_listSessionsMsg(), results => {
                client.end();
                let sessions = _.find(results, 'sessions')['sessions'];
                if (sessions) {
                    connections.forEach(connection => {
                        let sessionType = connection[0],
                            sessionId = connection[1]
                        if (sessions.indexOf(sessionId) != -1) {
                            let client = calvaLib.nrepl_create(options).once('connect', () => {
                                client.send(calvaLib.message_closeMsg(sessionId), () => {
                                    client.end();
                                    n--;
                                    state.cursor.set(sessionType, null);
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
    let chan = state.deref().get('outputChannel');

    disconnect({ hostname, port }, () => {
        state.cursor.set('connecting', true);
        status.update();

        let onConnect = () => {
            chan.appendLine("Hooking up nREPL sessions...");

            client.send(calvaLib.message_cloneMsg(), cloneResults => {
                client.end();
                let cljSession = _.find(cloneResults, 'new-session')['new-session'];
                if (cljSession) {
                    state.cursor.set("clj", cljSession);
                    state.cursor.set("cljc", cljSession);
                    state.cursor.set("connected", true);
                    state.cursor.set("connecting", false);
                    status.update();
                    chan.appendLine("Connected session: clj");
                    terminal.createREPLTerminal('clj', null, chan);

                    makeCljsSessionClone(hostname, port, cljSession, null, (cljsSession, shadowBuild) => {
                        if (cljsSession) {
                            setUpCljsRepl(cljsSession, chan, shadowBuild);
                        }
                        chan.appendLine('cljc files will use the clj REPL.' + (cljsSession ? ' (You can toggle this at will.)' : ''));
                        //evaluate.evaluateFile();
                        status.update();
                    });
                } else {
                    state.cursor.set("connected", false);
                    state.cursor.set("connecting", false);
                    chan.appendLine("Failed connecting. (Calva needs a REPL started before it can connect.)");
                }
            });
        };

        let client = calvaLib.nrepl_create({
            "host": hostname,
            "port": port,
            "on-connect": onConnect
        });
    });
}

function setUpCljsRepl(cljsSession, chan, shadowBuild) {
    state.cursor.set("cljs", cljsSession);
    chan.appendLine("Connected session: cljs");
    terminal.createREPLTerminal('cljs', shadowBuild, chan);
}

function makeCljsSessionClone(hostname, port, session, shadowBuild, callback) {
    let chan = state.deref().get('outputChannel');

    if (shadow.isShadowCljs() && !shadowBuild) {
        chan.appendLine("This looks like a shadow-cljs coding session.");
        vscode.window.showQuickPick(shadow.shadowBuilds(), {
            placeHolder: "Select which shadow-cljs build to connect to",
            ignoreFocusOut: true
        }).then(build => {
            if (build) {
                makeCljsSessionClone(hostname, port, session, build, callback);
            }
        });
    } else {
        let client = calvaLib.nrepl_create({ hostname, port }).once('connect', () => {
            client.send(calvaLib.message_cloneMsg(session), results => {
                client.end();
                let cljsSession = _.find(results, 'new-session')['new-session'];
                if (cljsSession) {
                    let client = calvaLib.nrepl_create({ hostname, port }).once('connect', () => {
                        let msg = shadowBuild ? calvaLib.message_startShadowCljsReplMsg(cljsSession, shadowBuild) :
                            calvaLib.message_evalCode(cljsSession, util.getCljsReplStartCode());
                        client.send(msg, cljsResults => {
                            client.end();
                            let valueResult = _.find(cljsResults, 'value'),
                                nsResult = _.find(cljsResults, 'ns');
                            if (!shadowBuild && nsResult) {
                                state.cursor.set('shadowBuild', null);
                                callback(cljsSession);
                            } else if (shadowBuild && valueResult && valueResult.value.match(":selected " + shadowBuild)) {
                                state.cursor.set('shadowBuild', shadowBuild);
                                callback(cljsSession, shadowBuild);
                            } else {
                                if (shadowBuild) {
                                    let failed = `Failed starting cljs repl for shadow-cljs build: ${shadowBuild}`;
                                    state.cursor.set('shadowBuild', null);
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
    let current = state.deref(),
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
                state.cursor.set("hostname", hostname);
                state.cursor.set("port", parsedPort);
                connectToHost(hostname, parsedPort);
            } else {
                chan.appendLine("Bad url: " + url);
                state.cursor.set('connecting', false);
                status.update();
            }
        } else {
            state.cursor.set('connecting', false);
            status.update();
        }
    });
}

function connect(isAutoConnect = false) {
    let current = state.deref(),
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
                state.cursor.set("hostname", "localhost");
                state.cursor.set("port", port);
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
    state.reset();
    connect(true);
}

function autoConnect() {
    connect(true);
}

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

function recreateCljsRepl() {
    let current = state.deref(),
        cljSession = util.getSession('clj'),
        chan = current.get('outputChannel'),
        hostname = current.get('hostname'),
        port = current.get('port');

    makeCljsSessionClone(hostname, port, cljSession, null, (session, shadowBuild) => {
        if (session) {
            setUpCljsRepl(session, chan, shadowBuild);
        }
        status.update();
    })
}

export default {
    connect,
    disconnect,
    reconnect,
    autoConnect,
    toggleCLJCSession,
    recreateCljsRepl
};
