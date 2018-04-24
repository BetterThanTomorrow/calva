const vscode = require('vscode');
const _ = require('lodash');
const fs = require('fs');
const state = require('./state');
const repl = require('./repl/client');
const message = require('./repl/message');
const util = require('./utilities');
const status = require('./status');
const terminal = require('./terminal');
//const evaluate = require('./repl/middleware/evaluate');
const edn = require('jsedn');

function shadowNReplPortFile() {
    return util.getProjectDir() + '/.shadow-cljs/nrepl.port';
}

function shadowConfigFile() {
    return util.getProjectDir() + '/shadow-cljs.edn';
}

function isShadowCljs() {
    return fs.existsSync(shadowNReplPortFile());
}

function shadowBuilds() {
    let parsed = edn.parse(fs.readFileSync(shadowConfigFile(), 'utf8').toString()),
        keys = parsed.at(edn.kw(':builds')).keys;
    return _.map(keys, 'name');
}

function nreplPortFile() {
    if (fs.existsSync(shadowNReplPortFile())) {
        return shadowNReplPortFile();
    }
    else {
        return util.getProjectDir() + '/.nrepl-port'
    }
}

function disconnect(options = null, callback = () => { }) {
    let chan = state.deref().get('outputChannel'),
        connections = [];


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
        let client = repl.create(options).once('connect', () => {
            client.send(message.listSessions(), results => {
                client.end();
                let sessions = _.find(results, 'sessions')['sessions'];
                if (sessions) {
                    connections.forEach(connection => {
                        let sessionType = connection[0],
                            sessionId = connection[1]
                        if (sessions.indexOf(sessionId) != -1) {
                            let client = repl.create(options).once('connect', () => {
                                client.send(message.close(sessionId), () => {
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

function connectToHost(hostname, port, shadowBuild = undefined) {
    let chan = state.deref().get('outputChannel');

    if (isShadowCljs() && shadowBuild === undefined) {
        chan.appendLine("This looks like a shadow-cljs coding session.");
        vscode.window.showQuickPick(shadowBuilds(), {
            placeHolder: "Select which shadow-cljs build to connect to",
            ignoreFocusOut: true
        }).then(build => {
            if (build !== undefined) {
                connectToHost(hostname, port, build);
            }
        });
    } else {
        disconnect({ hostname, port }, () => {
            state.cursor.set('connecting', true);
            status.update();

            chan.appendLine("Hooking up nREPL sessions...");

            let client = repl.create({
                hostname,
                port
            }).once('connect', () => {
                client.send(message.clone(), cloneResults => {
                    client.end();
                    let cljSession = _.find(cloneResults, 'new-session')['new-session'];
                    if (cljSession) {
                        state.cursor.set("clj", cljSession);
                        state.cursor.set("cljc", cljSession);
                        state.cursor.set("connected", true);
                        state.cursor.set("connecting", false);
                        status.update();
                        chan.appendLine("Connected session: clj");
                        terminal.createREPLTerminal('clj', shadowBuild, chan);

                        makeCljsSessionClone(hostname, port, cljSession, shadowBuild, cljsSession => {
                            if (cljsSession) {
                                state.cursor.set("cljs", cljsSession);
                                chan.appendLine("Connected session: cljs");
                                terminal.createREPLTerminal('cljs', shadowBuild, chan);
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
            });
        });
    }
};

function makeCljsSessionClone(hostname, port, session, shadowBuild, callback) {
    let chan = state.deref().get('outputChannel');

    let client = repl.create({ hostname, port }).once('connect', () => {
        client.send(message.clone(session), results => {
            client.end();
            let cljsSession = _.find(results, 'new-session')['new-session'];
            if (cljsSession) {
                let client = repl.create({ hostname, port }).once('connect', () => {
                    let msg = shadowBuild ? message.startShadowCljsReplMsg(cljsSession, shadowBuild) : message.startCljsReplMsg(cljsSession);
                    client.send(msg, cljsResults => {
                        client.end();
                        let valueResult = _.find(cljsResults, 'value'),
                            nsResult = _.find(cljsResults, 'ns');
                        if ((!shadowBuild && nsResult) || (shadowBuild && valueResult && valueResult.value.match(":selected " + shadowBuild))) {
                            callback(cljsSession);
                        }
                        else {
                            if (shadowBuild) {
                                chan.appendLine("Failed starting cljs repl for shadow-cljs build: " + shadowBuild);
                                console.log(cljsResults);
                            }
                            callback(null);
                        }
                    })
                });
            }
        });
    });
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
};

function reconnect() {
    state.reset();
    connect();
};

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

module.exports = {
    connect,
    disconnect,
    reconnect,
    autoConnect,
    toggleCLJCSession
};
