import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as fs from 'fs';
import * as state from './state';
import * as util from './utilities';
import shadow from './shadow';
import status from './status';
import terminal from './terminal';

import { NReplClient, NReplSession } from "./nrepl";

function nreplPortFile() {
    if (fs.existsSync(shadow.shadowNReplPortFile()))
        return shadow.shadowNReplPortFile();
    else
        return util.getProjectDir() + '/.nrepl-port'
}

function disconnect(options = null, callback = () => { }) {
    ['clj', 'cljs'].forEach(sessionType => {
        state.cursor.set(sessionType, null);
    });
    state.cursor.set("connected", false);
    state.cursor.set('cljc', null);
    status.update();

    nClient.close();
    callback();
}

async function connectToHost(hostname, port) {
    let chan = state.deref().get('outputChannel');
    if(nClient)
        nClient.close();
    state.cursor.set('connecting', true);
    status.update();

    try {
        nClient = await NReplClient.create({ host: hostname, port: +port})
        cljSession = nClient.session;

        chan.appendLine("Hooking up nREPL sessions...");

        state.cursor.set("connected", true);
        state.cursor.set("connecting", false);
        state.cursor.set('clj', cljSession)
        status.update();

        //cljsSession = nClient.session;
        terminal.createREPLTerminal('clj', null, chan);

        let [cljsSession, shadowBuild] = await makeCljsSessionClone(cljSession, null);
        if (cljsSession)
            setUpCljsRepl(cljsSession, chan, shadowBuild);
        chan.appendLine('cljc files will use the clj REPL.' + (cljsSession ? ' (You can toggle this at will.)' : ''));
        //evaluate.evaluateFile();
        status.update();

    } catch(e) {
        state.cursor.set("connected", false);
        state.cursor.set("connecting", false);
        chan.appendLine("Failed connecting. (Calva needs a REPL started before it can connect.)");
    }


    /*
    disconnect({ hostname, port }, () => {
        let onDisconnect = (_client, err) => {
            chan.appendLine("Disconnected from nREPL server." + (err ? " Error: " + err : ""));
            state.cursor.set("clj", null);
            state.cursor.set("cljc", null);
            state.cursor.set("connected", false);
            state.cursor.set("connecting", false);
            status.update();
        }
    });
    */
}

function setUpCljsRepl(cljsSession, chan, shadowBuild) {
    state.cursor.set("cljs", cljsSession);
    chan.appendLine("Connected session: cljs");
    terminal.createREPLTerminal('cljs', shadowBuild, chan);
    status.update();
}

async function makeCljsSessionClone(session, shadowBuild) {
    let chan = state.deref().get('outputChannel');

    if (shadow.isShadowCljs() && !shadowBuild) {
        chan.appendLine("This looks like a shadow-cljs coding session.");
        let build = await vscode.window.showQuickPick(shadow.shadowBuilds(), {
            placeHolder: "Select which shadow-cljs CLJS REPL to connect to",
            ignoreFocusOut: true
        });
        if (build)
            return makeCljsSessionClone(session, build);
    } else {
        cljsSession = await cljSession.clone();
        if(cljsSession) {
            let isFigwheel = !shadowBuild;
            let initCode = shadowBuild ? shadowCljsReplStart(shadowBuild) : util.getCljsReplStartCode();
            let out = "";
            let result = cljsSession.eval(initCode, { stdout: x => out+=x });
            try {
                let valueResult = await result.value
                setTimeout(() => {
                    if(out != "")
                        vscode.window.showInformationMessage(out);
                }, 100)
                
                state.cursor.set('cljs', cljsSession)
                state.cursor.set('cljc', cljsSession)
                if(!shadowBuild && result.ns){
                    state.cursor.set('shadowBuild', null)
                    return [cljsSession, null];
                } else if(shadowBuild  && valueResult.match(/:selected/)) {
                    state.cursor.set('shadowBuild', shadowBuild);
                    return [cljsSession, shadowBuild];
                }
            } catch(e) {
                if(shadowBuild) {
                    let failed = `Failed starting cljs repl for shadow-cljs build: ${shadowBuild}`;
                    state.cursor.set('shadowBuild', null);
                    chan.appendLine(`${failed}. Is the build running and conected?`);
                    console.error(failed);
                } else {
                    let failed = `Failed to start ClojureScript REPL with command: ${initCode}`;
                    console.error(failed);
                    chan.appendLine(`${failed}. Is the app running in the browser and conected?`);
                }
            }
        }
    }
    return [null, null];
}

function shadowCljsReplStart(buildOrRepl: string) {
    if(!buildOrRepl)
        return null;
    if(buildOrRepl.charAt(0) == ":")
        return `(shadow.cljs.devtools.api/nrepl-select ${buildOrRepl})`
    else
        return `(shadow.cljs.devtools.api/${buildOrRepl})`
}

async function promptForNreplUrlAndConnect(port) {
    let current = state.deref(),
        chan = current.get('outputChannel');

    let url = await vscode.window.showInputBox({
        placeHolder: "Enter existing nREPL hostname:port here...",
        prompt: "Add port to nREPL if localhost, otherwise 'hostname:port'",
        value: "localhost:" + (port ? port : ""),
        ignoreFocusOut: true
    })
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
}

export let nClient: NReplClient;
export let cljSession: NReplSession;
export let cljsSession: NReplSession;

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

async function recreateCljsRepl() {
    let current = state.deref(),
        cljSession = util.getSession('clj'),
        chan = current.get('outputChannel');

    let [session, shadowBuild] = await makeCljsSessionClone(cljSession, null);
    if (session)
        setUpCljsRepl(session, chan, shadowBuild);
    status.update();
}

export default {
    connect,
    disconnect,
    reconnect,
    autoConnect,
    toggleCLJCSession,
    recreateCljsRepl
};
