import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as fs from 'fs';
import * as path from 'path';
import * as state from './state';
import * as util from './utilities';
import * as shadow from "./shadow"
import * as open from 'open';
import status from './status';

import { NReplClient, NReplSession } from "./nrepl";
import { reconnectReplWindow, openReplWindow } from './repl-window';

export type ProjectType = {
    name: string;
    cljsTypes: string[];
    cmd: string;
    winCmd: string;
    commandLine: (includeCljs: boolean) => any;
    useWhenExists: string;
    nReplPortFile: () => string;
};

async function connectToHost(hostname, port, cljsTypeName: string, replTypes: ReplType[]) {
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
        await openReplWindow("clj", true);
        await reconnectReplWindow("clj").catch(reason => {
            console.error("Failed reconnecting REPL window: ", reason);
        });

        state.cursor.set("connected", true);
        state.analytics().logEvent("REPL", "ConnectedCLJ").send();
        state.cursor.set("connecting", false);
        state.cursor.set('clj', cljSession)
        state.cursor.set('cljc', cljSession)
        status.update();

        //cljsSession = nClient.session;
        //terminal.createREPLTerminal('clj', null, chan);
        let cljsSession = null,
            shadowBuild = null;
        try {
            [cljsSession, shadowBuild] = cljsTypeName != "" ? await makeCljsSessionClone(cljSession, cljsTypeName, replTypes) : [null, null];
        } catch (e) {
            chan.appendLine("Error while connecting cljs REPL: " + e);
        }
        if (cljsSession)
            await setUpCljsRepl(cljsSession, chan, shadowBuild);
        chan.appendLine('cljc files will use the clj REPL.' + (cljsSession ? ' (You can toggle this at will.)' : ''));
        //evaluate.loadFile();
        status.update();

    } catch (e) {
        state.cursor.set("connected", false);
        state.cursor.set("connecting", false);
        chan.appendLine("Failed connecting.");
        state.analytics().logEvent("REPL", "FailedConnectingCLJ").send();
        return false;
    }

    return true;
}

async function setUpCljsRepl(cljsSession, chan, shadowBuild) {
    state.cursor.set("cljs", cljsSession);
    chan.appendLine("Connected session: cljs");
    await openReplWindow("cljs", true);
    await reconnectReplWindow("cljs");
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
type processOutputFn = (output: string) => void;
type connectFn = (session: NReplSession, name: string, checkSuccess: checkConnectedFn) => Promise<boolean>;

async function evalConnectCode(newCljsSession: NReplSession, code: string,
    name: string, checkSuccess: checkConnectedFn, outputProcessors?: processOutputFn[]): Promise<boolean> {
    let chan = state.connectionLogChannel();
    let err = [], out = [], result = await newCljsSession.eval(code, {
        stdout: x => {
            if (outputProcessors) {
                for (const p of outputProcessors) {
                    p(x);
                }
            }
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

export interface ReplType {
    name: string,
    start?: connectFn;
    started?: (valueResult: string, out: any[], err: any[]) => boolean;
    connect?: connectFn;
    connected: (valueResult: string, out: any[], err: any[]) => boolean;
}

export let cljsReplTypes: ReplType[] = [
    {
        name: "Figwheel Main",
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
                err != undefined && err.find((x: string) => {
                    return x.search("already running") >= 0
                });
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
                const initCode = `(do (use 'figwheel.main.api) (figwheel.main.api/cljs-repl "${build}"))`;
                return evalConnectCode(session, initCode, name, checkFn);
            } else {
                let chan = state.outputChannel();
                chan.appendLine("Connection aborted.");
                throw "Aborted";
            }
        },
        connected: (_result, out, _err) => {
            return out.find((x: string) => { return x.search("To quit, type: :cljs/quit") >= 0 }) != undefined
        }
    },
    {
        name: "Figwheel",
        connect: async (session, name, checkFn) => {
            state.extensionContext.workspaceState.update('cljsReplTypeHasBuilds', false);
            state.cursor.set('cljsBuild', null);
            const initCode = "(do (use 'figwheel-sidecar.repl-api) (if (not (figwheel-sidecar.repl-api/figwheel-running?)) (figwheel-sidecar.repl-api/start-figwheel!)) (figwheel-sidecar.repl-api/cljs-repl))";
            return evalConnectCode(session, initCode, name, checkFn,
                [(output) => {
                    let matched = output.match(/Figwheel: Starting server at (.*)/);
                    if (matched && matched.length > 1) {
                        let chan = state.outputChannel();
                        chan.appendLine(matched[0]);
                        if (state.config().openBrowserWhenFigwheelStarted) {
                            chan.appendLine("Opening Figwheel app in the browser (this automatic behaviour can be disabled using Settings) ...");
                            open(matched[1]).catch(reason => {
                                console.error("Error opening Figwheel app in browser: ", reason);
                            });
                        } else {
                            chan.appendLine("Not automaticaly opening Figwheel app in the browser (this can be disabled using Settings).");
                        }
                        chan.appendLine("The CLJS REPL session will be connected when the Figwheel app has been started in the browser.");
                    }
                }]);
        },
        connected: (_result, out, _err) => {
            return out.find((x: string) => { return x.search("Prompt will show") >= 0 }) != undefined
        }
    },
    {
        name: "shadow-cljs",
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
];

type customCLJSREPLType = {
    name: string,
    startCode: string,
    tellUserToStartRegExp?: string,
    printThisLineRegExp?: string,
    connectedRegExp: string,
};

function createCustomCLJSReplType(custom: customCLJSREPLType): ReplType {
    return {
        name: custom.name,
        connect: (session, name, checkFn) => {
            const chan = state.outputChannel();
            state.extensionContext.workspaceState.update('cljsReplTypeHasBuilds', false);
            state.cursor.set('cljsBuild', null);
            const initCode = custom.startCode;
            let outputProcessors: processOutputFn[] = [];
            if (custom.tellUserToStartRegExp) {
                outputProcessors.push((output) => {
                    if (custom.tellUserToStartRegExp) {
                        const matched = output.match(custom.tellUserToStartRegExp);
                        if (matched && matched.length > 0) {
                            chan.appendLine("CLJS REPL ready to connect. Please, start your ClojureScript app.");
                            chan.appendLine("  The CLJS REPL will connect when your app is running.");
                        }
                    }
                });
            }
            if (custom.printThisLineRegExp) {
                outputProcessors.push((output) => {
                    if (custom.printThisLineRegExp) {
                        const matched = output.match(`.*(${custom.printThisLineRegExp}).*`);
                        if (matched && matched.length > 0) {
                            chan.appendLine(util.stripAnsi(matched[0]));
                        }
                    }
                });
            }
            return evalConnectCode(session, initCode, name, checkFn, outputProcessors);
        },
        connected: (_result, out, err) => {
            return out.find((x: string) => { return x.search(custom.connectedRegExp) >= 0 }) != undefined
        }
    }
}

export function getCustomCLJSRepl(): ReplType {
    const replConfig = state.config().customCljsRepl;
    if (replConfig) {
        return createCustomCLJSReplType(replConfig as customCLJSREPLType);
    } else {
        return undefined;
    }
}

function getCLJSReplTypes() {
    let types = cljsReplTypes.slice();
    const customType = getCustomCLJSRepl();
    if (customType) {
        types.push(customType);
    }
    return types;
}

async function makeCljsSessionClone(session, replType, replTypes: ReplType[]) {
    let chan = state.outputChannel();
    let repl: ReplType;

    chan.appendLine("Creating cljs repl session...");
    let newCljsSession = await session.clone();
    if (newCljsSession) {
        chan.show(true);
        state.extensionContext.workspaceState.update('cljsReplType', replType);
        state.analytics().logEvent("REPL", "ConnectingCLJS", replType).send();
        repl = replTypes.find(x => x.name == replType);
        if (repl.start != undefined) {
            chan.appendLine("Starting repl for: " + repl.name + "...");
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
        chan.appendLine("Connecting CLJS repl: " + repl.name + "...");
        chan.appendLine("  Compiling and stuff. This can take a minute or two.");
        chan.appendLine("  See Calva Connection Log for detailed progress updates.");
        if (await repl.connect(newCljsSession, repl.name, repl.connected)) {
            state.analytics().logEvent("REPL", "ConnectedCLJS", repl.name).send();
            state.cursor.set('cljs', cljsSession = newCljsSession);
            return [cljsSession, null];
        } else {
            let build = state.deref().get('cljsBuild')
            state.analytics().logEvent("REPL", "FailedConnectingCLJS", repl.name).send();
            let failed = "Failed starting cljs repl" + (build != null ? ` for build: ${build}` : "");
            chan.appendLine(`${failed}. Is the build running and connected?\n   See the Output channel "Calva Connection Log" for any hints on what went wrong.`);
            state.cursor.set('cljsBuild', null);
        }
    }
    return [null, null];
}

async function promptForNreplUrlAndConnect(port, cljsTypeName, replTypes: ReplType[]) {
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
            await connectToHost(hostname, parsedPort, cljsTypeName, replTypes);
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

export function nreplPortFile(subPath: string = ".nrepl-port"): string {
    let editor = vscode.window.visibleTextEditors.find(x => x.document.languageId == "clojure");
    if (editor) {
        let d = path.dirname(editor.document.fileName);
        let prev = null;
        while (d != prev) {
            const p = path.resolve(d, subPath);
            if (fs.existsSync(p)) {
                return p;
            }
            prev = d;
            d = path.resolve(d, "..");
        }
        return path.join(util.getProjectDir(), subPath);
    } else {
        return path.join(util.getProjectDir(), subPath);
    }
}

export async function connect(isAutoConnect = false, isJackIn = false) {
        let chan = state.outputChannel();
        let cljsTypeName: string;

        state.analytics().logEvent("REPL", "ConnectInitiated", isAutoConnect ? "auto" : "manual");

        const types = getCLJSReplTypes();
        const CLJS_PROJECT_TYPE_NONE = "Don't load any cljs support, thanks"
        if (isJackIn) {
            cljsTypeName = state.extensionContext.workspaceState.get('selectedCljsTypeName');
        } else {
            let typeNames = types.map(x => x.name);
            typeNames.splice(0, 0, CLJS_PROJECT_TYPE_NONE)
            cljsTypeName = await util.quickPickSingle({
                values: typeNames,
                placeHolder: "If you want ClojureScript support, please select a cljs project type", saveAs: "connect-cljs-type", autoSelect: true
            });
            if (!cljsTypeName) {
                state.analytics().logEvent("REPL", "ConnectInterrupted", "NoCljsProjectPicked").send();
                return;
            }
        }

        state.analytics().logEvent("REPL", "ConnnectInitiated", cljsTypeName).send();

        if (cljsTypeName == CLJS_PROJECT_TYPE_NONE) {
            cljsTypeName = "";
        }

        const portFile = cljsTypeName === "shadow-cljs" ? nreplPortFile(".shadow-cljs/nrepl.port") : nreplPortFile();

        state.extensionContext.workspaceState.update('selectedCljsTypeName', cljsTypeName);

        if (fs.existsSync(portFile)) {
            let port = fs.readFileSync(portFile, 'utf8');
            if (port) {
                if (isAutoConnect) {
                    state.cursor.set("hostname", "localhost");
                    state.cursor.set("port", port);
                    await connectToHost("localhost", port, cljsTypeName, types);
                } else {
                    await promptForNreplUrlAndConnect(port, cljsTypeName, types);
                }
            } else {
                chan.appendLine('No nrepl port file found. (Calva does not start the nrepl for you, yet.) You might need to adjust "calva.projectRootDirectory" in Workspace Settings.');
                await promptForNreplUrlAndConnect(port, cljsTypeName, types);
            }
        } else {
            await promptForNreplUrlAndConnect(null, cljsTypeName, types);
        }
        return true;
    }

export default {
    connect: connect,
    disconnect: function (options = null, callback = () => { }) {
        ['clj', 'cljs'].forEach(sessionType => {
            state.cursor.set(sessionType, null);
        });
        state.cursor.set("connected", false);
        state.cursor.set('cljc', null);
        status.update();

        nClient.close();
        callback();
    },
    nreplPortFile: nreplPortFile,
    toggleCLJCSession: function () {
        let current = state.deref();

        if (current.get('connected')) {
            if (util.getSession('cljc') == util.getSession('cljs')) {
                state.cursor.set('cljc', util.getSession('clj'));
            } else if (util.getSession('cljc') == util.getSession('clj')) {
                state.cursor.set('cljc', util.getSession('cljs'));
            }
            status.update();
        }
    },
    recreateCljsRepl: async function () {
        let current = state.deref(),
            cljSession = util.getSession('clj'),
            chan = state.outputChannel();
        const cljsTypeName = state.extensionContext.workspaceState.get('selectedCljsTypeName');

        let [session, shadowBuild] = await makeCljsSessionClone(cljSession, cljsTypeName, getCLJSReplTypes());
        if (session)
            await setUpCljsRepl(session, chan, shadowBuild);
        status.update();
    },
    getCustomCLJSRepl: getCustomCLJSRepl
};
