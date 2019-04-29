import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as fs from 'fs';
import * as path from 'path';
import * as state from './state';
import * as util from './utilities';
import * as shadow from "./shadow"
import status from './status';

import { NReplClient, NReplSession } from "./nrepl";
import { reconnectRepl } from './repl-window';

function nreplPortFile() {
    if (fs.existsSync(shadow.shadowNReplPortFile()))
        return shadow.shadowNReplPortFile();
    else if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.fileName) {
        let d = path.dirname(vscode.window.activeTextEditor.document.fileName);
        let prev = null;
        while (d != prev) {
            const p = path.resolve(d, ".nrepl-port");
            if (fs.existsSync(p)) {
                return p;
            }
            prev = d;
            d = path.resolve(d, "..");
        }
    } else
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
    state.analytics().logEvent("REPL", "Connecting").send();

    let chan = state.outputChannel();
    if (nClient) {
        nClient["silent"] = true;
        nClient.close();
    }
    cljsSession = cljSession = null;
    state.cursor.set('connecting', true);
    status.update();
    try {
        chan.appendLine("Hooking up nREPL sessions...");
        // Create an nREPL client. waiting for the connection to be established.
        nClient = await NReplClient.create({ host: hostname, port: +port })
        nClient.addOnCloseHandler(c => {
            state.cursor.set("connected", false);
            state.cursor.set("connecting", false);
            if (!c["silent"]) // we didn't deliberately close this session, mention this fact.
                chan.appendLine("nREPL Connection was closed");
            status.update();
        })
        cljSession = nClient.session;
        chan.appendLine("Connected session: clj");
        reconnectRepl("clj", cljSession);

        state.cursor.set("connected", true);
        state.cursor.set("connecting", false);
        state.cursor.set('clj', cljSession)
        state.cursor.set('cljc', cljSession)
        status.update();

        //cljsSession = nClient.session;
        //terminal.createREPLTerminal('clj', null, chan);

        let [cljsSession, shadowBuild] = await makeCljsSessionClone(cljSession);
        if (cljsSession)
            setUpCljsRepl(cljsSession, chan, shadowBuild);
        chan.appendLine('cljc files will use the clj REPL.' + (cljsSession ? ' (You can toggle this at will.)' : ''));
        //evaluate.loadFile();
        status.update();
        state.analytics().logEvent("REPL", "ConnectedCLJ").send();

    } catch (e) {
        state.cursor.set("connected", false);
        state.cursor.set("connecting", false);
        chan.appendLine("Failed connecting. (Calva needs a REPL started before it can connect.)");
        state.analytics().logEvent("REPL", "FailedConnectingCLJ").send();
        return false;
    }

    return true;

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
    reconnectRepl("cljs", cljsSession);
    //terminal.createREPLTerminal('cljs', shadowBuild, chan);
    status.update();
}


function shadowCljsReplStart(buildOrRepl: string) {
    if (!buildOrRepl)
        return null;
    if (buildOrRepl.charAt(0) == ":")
        return `(shadow.cljs.devtools.api/nrepl-select ${buildOrRepl})`
    else
        return `(shadow.cljs.devtools.api/${buildOrRepl})`
}

function getFigwheelMainProjects() {
    let chan = state.outputChannel();
    let res = fs.readdirSync(util.getProjectDir());
    let projects = res.filter(x => x.match(/\.cljs\.edn/)).map(x => x.replace(/\.cljs\.edn$/, ""));
    if (projects.length == 0) {
        vscode.window.showErrorMessage("There are no figwheel project files (.cljs.edn) in the project directory.");
        chan.appendLine("There are no figwheel project files (.cljs.edn) in the project directory.");
        chan.appendLine("Connection to Figwheel Main aborted.");
        throw "Aborted";
    }
    return projects;
}

type checkConnectedFn = (value: string, out: any[], err: any[]) => boolean;
type connectFn = (session: NReplSession, name: string, checkSuccess: checkConnectedFn) => Promise<boolean>;

async function evalConnectCode(newCljsSession: NReplSession, code: string, name: string, checkSuccess: checkConnectedFn): Promise<boolean> {
    let chan = state.connectionLogChannel();
    let err = [], out = [], result = await newCljsSession.eval(code, {
        stdout: x => {
            out.push(util.stripAnsi(x));
            chan.append(util.stripAnsi(x));
        }, stderr: x => {
            err.push(util.stripAnsi(x));
            chan.append(util.stripAnsi(x));
        }
    });
    let valueResult = await result.value
        .catch(reason => {
            // console.error("Error evaluating connect form: ", reason);
        });
    if (checkSuccess(valueResult, out, err)) {
        state.analytics().logEvent("REPL", "ConnectedCLJS", name).send();
        state.cursor.set('cljs', cljsSession = newCljsSession)
        return true
    } else {
        return false;
    }
}

interface ReplType {
    name: string,
    ns: string;
    start?: connectFn;
    started?: (valueResult: string, out: any[], err: any[]) => boolean;
    connect?: connectFn;
    connected: (valueResult: string, out: any[], err: any[]) => boolean;
}

let cljsReplTypes: ReplType[] = [
    {
        name: "Figwheel Main",
        ns: "figwheel.main",
        start: async (session, name, checkFn) => {
            let projects = getFigwheelMainProjects();
            let builds = projects.length <= 1 ? projects : await util.quickPickMulti({
                values: projects,
                placeHolder: "Please select which builds to start",
                saveAs: "figwheel-main-projects"
            })
            if (builds) {
                state.extensionContext.workspaceState.update('cljsReplTypeHasBuilds', true);
                state.cursor.set('cljsBuild', builds[0]);
                const initCode = `(do (require 'figwheel.main.api) (figwheel.main.api/start ${builds.map(x => { return `"${x}"` }).join(" ")}))`;
                return evalConnectCode(session, initCode, name, checkFn);
            }
            else {
                let chan = state.outputChannel();
                chan.appendLine("Connection to Figwheel Main aborted.");
                throw "Aborted";
            }
        },
        started: (result, out, err) => {
            return out.find((x: string) => { return x.search("Prompt will show") >= 0 }) != undefined ||
                err != undefined && err.find((x: string) => { return x.search("already running") >= 0 });
        },
        connect: async (session, name, checkFn) => {
            let build = await util.quickPickSingle({
                values: getFigwheelMainProjects(),
                placeHolder: "Select which build to connect to",
                saveAs: "figwheel-main-build"
            });
            if (build) {
                state.extensionContext.workspaceState.update('cljsReplTypeHasBuilds', true);
                state.cursor.set('cljsBuild', build);
                const initCode = `(do (require 'figwheel.main.api) (figwheel.main.api/cljs-repl "${build}"))`;
                return evalConnectCode(session, initCode, name, checkFn);
            } else {
                let chan = state.outputChannel();
                chan.appendLine("Connection aborted.");
                throw "Aborted";
            }
        },
        connected: (_result, out, _err) => {
            return out.find((x: string) => { return x.search("Prompt will show") >= 0 }) != undefined
        }
    },
    {
        name: "Figwheel",
        ns: "figwheel-sidecar.repl-api",
        connect: async (session, name, checkFn) => {
            state.extensionContext.workspaceState.update('cljsReplTypeHasBuilds', false);
            state.cursor.set('cljsBuild', null);
            const initCode = "(do (require 'figwheel-sidecar.repl-api) (if (not (figwheel-sidecar.repl-api/figwheel-running?)) (figwheel-sidecar.repl-api/start-figwheel!)) (figwheel-sidecar.repl-api/cljs-repl))";
            return evalConnectCode(session, initCode, name, checkFn);
        },
        connected: (_result, out, _err) => {
            return out.find((x: string) => { return x.search("Prompt will show") >= 0 }) != undefined
        }
    },
    {
        name: "shadow-cljs",
        ns: "shadow.cljs.devtools.api",
        connect: async (session, name, checkFn) => {
            let build = await util.quickPickSingle({
                values: shadow.shadowBuilds(),
                placeHolder: "Select which build to connect to",
                saveAs: "shadow-cljs-build"
            });
            if (build) {
                state.extensionContext.workspaceState.update('cljsReplTypeHasBuilds', true);
                state.cursor.set('cljsBuild', build);
                const initCode = shadowCljsReplStart(build);
                return evalConnectCode(session, initCode, name, checkFn);
            } else {
                let chan = state.outputChannel();
                chan.appendLine("Connection aborted.");
                throw "Aborted";
            }
        },
        connected: (result, _out, _err) => {
            return result.search(/:selected/) >= 0;
        }
    }
]

async function probeNamespaces(namespaces: string[]) {
    let result: string = await cljSession.eval(`(remove nil? (map #(try (do (require %) %) (catch Exception e)) '[${namespaces.join(' ')}]))`).value;
    return result.substring(1, result.length - 1).split(' ')
}

async function findCljsRepls(): Promise<ReplType[]> {
    let probe = [];
    for (let repl of cljsReplTypes)
        probe.push(repl.ns);
    let valid = await probeNamespaces(probe);
    let output: ReplType[] = [];
    for (let repl of cljsReplTypes) {
        if (valid.indexOf(repl.ns) != -1)
            output.push(repl);
    }
    return output;
}


async function makeCljsSessionClone(session) {
    let chan = state.outputChannel();
    let newCljsSession = await session.clone();
    let repl: ReplType;
    if (newCljsSession) {
        let chan = state.outputChannel();
        chan.show(true);
        let repls = await findCljsRepls();
        let replType = await util.quickPickSingle({ values: repls.map(x => x.name), placeHolder: "Select a cljs project type to use", saveAs: "cljs-repl-type" });
        if (!replType)
            return [null, null];
        state.extensionContext.workspaceState.update('cljsReplType', replType);
        state.analytics().logEvent("REPL", "ConnectingCLJS", replType).send();
        repl = repls.find(x => x.name == replType);
        if (repl.start != undefined) {
            chan.appendLine("Starting repl for: " + repl.name);
            if (await repl.start(newCljsSession, repl.name, repl.started)) {
                state.analytics().logEvent("REPL", "StartedCLJS", repl.name).send();
                chan.appendLine("Started cljs builds");
                newCljsSession = await session.clone();
            } else {
                state.analytics().logEvent("REPL", "FailedStartingCLJS", repl.name).send();
                chan.appendLine("Failed starting cljs repl");
                state.cursor.set('cljsBuild', null);
                return [null, null];
            }
        }
        chan.appendLine("Connecting to: " + repl.name);
        if (await repl.connect(newCljsSession, repl.name, repl.connected)) {
            state.analytics().logEvent("REPL", "ConnectedCLJS", repl.name).send();
            state.cursor.set('cljs', cljsSession = newCljsSession)
            return [cljsSession, null];
        } else {
            let build = state.deref().get('cljsBuild')
            state.analytics().logEvent("REPL", "FailedConnectingCLJS", repl.name).send();
            let failed = "Failed starting cljs repl" + (build != null ? ` for build: ${build}` : "");
            chan.appendLine(`${failed}. Is the build running and conected?`);
            state.cursor.set('cljsBuild', null);
        }
    }
    return [null, null];
}

async function promptForNreplUrlAndConnect(port) {
    let current = state.deref(),
        chan = state.outputChannel();

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
    return true;
}

export let nClient: NReplClient;
export let cljSession: NReplSession;
export let cljsSession: NReplSession;

async function connect(isAutoConnect = false) {
    state.analytics().logEvent("REPL", "ConnectInitiated", isAutoConnect ? "auto" : "manual").send();
    let current = state.deref(),
        chan = state.outputChannel();


    if (fs.existsSync(nreplPortFile())) {
        let port = fs.readFileSync(nreplPortFile(), 'utf8');
        if (port) {
            if (isAutoConnect) {
                state.cursor.set("hostname", "localhost");
                state.cursor.set("port", port);
                await connectToHost("localhost", port);
            } else {
                await promptForNreplUrlAndConnect(port);
            }
        } else {
            chan.appendLine('No nrepl port file found. (Calva does not start the nrepl for you, yet.) You might need to adjust "calva.projectRootDirectory" in Workspace Settings.');
            await promptForNreplUrlAndConnect(port);
        }
    } else {
        await promptForNreplUrlAndConnect(null);
    }
    return true;
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
        chan = state.outputChannel();

    let [session, shadowBuild] = await makeCljsSessionClone(cljSession);
    if (session)
        setUpCljsRepl(session, chan, shadowBuild);
    status.update();
}

export default {
    connect,
    disconnect,
    nreplPortFile,
    toggleCLJCSession,
    recreateCljsRepl
};
