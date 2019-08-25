import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as fs from 'fs';
import * as path from 'path';
import * as state from './state';
import * as util from './utilities';
import * as open from 'open';
import status from './status';

const { parseEdn } = require('../cljs-out/cljs-lib');
import { NReplClient, NReplSession } from "./nrepl";
import { reconnectReplWindow, openReplWindow, sendTextToREPLWindow } from './repl-window';
import { CustomCljsType, ReplConnectSequence, getDefaultCljsType } from './nrepl/connectSequence';

const PROJECT_DIR_KEY = "connect.projectDir";
const PROJECT_WS_FOLDER_KEY = "connect.projecWsFolder";

export function getProjectRoot(): string {
    return state.deref().get(PROJECT_DIR_KEY);
}

export function getProjectWsFolder(): vscode.WorkspaceFolder {
    return state.deref().get(PROJECT_WS_FOLDER_KEY);
}

/**
 * Figures out, and stores, the current clojure project root
 * Also stores the WorkSpace folder for the project to be used
 * when executing the Task and get proper vscode reporting.
 * 
 * 1. If there is no file open. Stop and complain.
 * 2. If there is a file open, use it to determine the project root
 *    by looking for project files from the file's directory and up to
 *    the window root (for plain folder windows) or the file's
 *    workspace folder root (for workspaces) to find the project root.
 *
 * If there is no project file found, then store either of these
 * 1. the window root for plain folders
 * 2. first workspace root for workspaces.
 * (This situation will be detected later by the connect process.)
 */
export async function initProjectDir(): Promise<void> {
    const projectFileNames: string[] = ["project.clj", "shadow-cljs.edn", "deps.edn"],
        doc = util.getDocument({}),
        workspaceFolder = doc ? vscode.workspace.getWorkspaceFolder(doc.uri) : null;
    if (!workspaceFolder) {
        vscode.window.showErrorMessage("There is no document opened in the workspace. Aborting. Please open a file in your Clojure project and try again.");
        state.analytics().logEvent("REPL", "JackinOrConnectInterrupted", "NoCurrentDocument").send();
        throw "There is no document opened in the workspace. Aborting.";
    } else {
        state.cursor.set(PROJECT_WS_FOLDER_KEY, workspaceFolder);
        let rootPath: string = path.resolve(workspaceFolder.uri.fsPath);
        let d = path.dirname(doc.uri.fsPath);
        let prev = null;
        while (d != prev) {
            for (let projectFile in projectFileNames) {
                const p = path.resolve(d, projectFileNames[projectFile]);
                if (fs.existsSync(p)) {
                    rootPath = d;
                    break;
                }
            }
            if (d == rootPath) {
                break;
            }
            prev = d;
            d = path.resolve(d, "..");
        }
        state.cursor.set(PROJECT_DIR_KEY, rootPath);
    }
}

export type ProjectType = {
    name: string;
    cljsTypes: string[];
    cmd: string;
    winCmd: string;
    commandLine: (includeCljs: boolean) => any;
    useWhenExists: string;
    nReplPortFile: () => string;
};

async function connectToHost(hostname, port, cljsTypeName: string, connectSequence: ReplConnectSequence) {
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

        if (connectSequence.afterCLJReplJackInCode) {
            state.outputChannel().appendLine("Evaluating `afterCLJReplJackInCode` in CLJ REPL Window");
            await sendTextToREPLWindow(connectSequence.afterCLJReplJackInCode, null, false);
        }

        //cljsSession = nClient.session;
        //terminal.createREPLTerminal('clj', null, chan);
        let cljsSession = null,
            shadowBuild = null;
        try {
            if (connectSequence.cljsType != undefined) {
                let cljsType: CustomCljsType = typeof connectSequence.cljsType == "string" ? getDefaultCljsType(cljsTypeName) : connectSequence.cljsType;
                let translatedReplType = createCLJSReplType(cljsType);

                [cljsSession, shadowBuild] = cljsTypeName != "" ? await makeCljsSessionClone(cljSession, cljsTypeName, translatedReplType) : [null, null];
            }
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

export function shadowConfigFile() {
    return getProjectRoot() + '/shadow-cljs.edn';
}

export function shadowBuilds() {
    let parsed = parseEdn(fs.readFileSync(shadowConfigFile(), 'utf8').toString()),
        builds: string[] = _.map(parsed.builds, (_v, key) => { return ":" + key });
    builds.push("node-repl");
    builds.push("browser-repl")
    return builds;
}

export function shadowBuild() {
    return state.deref().get('cljsBuild');
}

function getFigwheelMainProjects() {
    let chan = state.outputChannel();
    let res = fs.readdirSync(getProjectRoot());
    let projects = res.filter(x => x.match(/\.cljs\.edn/)).map(x => x.replace(/\.cljs\.edn$/, ""));
    if (projects.length == 0) {
        vscode.window.showErrorMessage("There are no figwheel project files (.cljs.edn) in the project directory.");
        chan.appendLine("There are no figwheel project files (.cljs.edn) in the project directory.");
        chan.appendLine("Connection to Figwheel Main aborted.");
        throw "Aborted";
    }
    return projects;
}

/**
 * ! DO it later
 */
function getFigwheelBuilds() {

}

type checkConnectedFn = (value: string, out: any[], err: any[]) => boolean;
type processOutputFn = (output: string) => void;
type connectFn = (session: NReplSession, name: string, checkSuccess: checkConnectedFn) => Promise<boolean>;

async function evalConnectCode(newCljsSession: NReplSession, code: string,
    name: string, checkSuccess: checkConnectedFn, outputProcessors: processOutputFn[] = [], errorProcessors: processOutputFn[] = []): Promise<boolean> {
    let chan = state.connectionLogChannel();
    let err = [], out = [], result = await newCljsSession.eval(code, {
        stdout: x => {
            out.push(util.stripAnsi(x));
            chan.append(util.stripAnsi(x));
            for (const p of outputProcessors) {
                p(util.stripAnsi(x));
            }
        }, stderr: x => {
            err.push(util.stripAnsi(x));
            chan.append(util.stripAnsi(x));
            for (const p of errorProcessors) {
                p(util.stripAnsi(x));
            }
        }
    });
    let valueResult = await result.value
        .catch(reason => {
            console.error("Error evaluating connect form: ", reason);
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
    started?: (valueResult: string, out: string[], err: string[]) => boolean;
    connect?: connectFn;
    connected: (valueResult: string, out: string[], err: string[]) => boolean;
}

function figwheelOrShadowBuilds(cljsTypeName: string): string[] {
    if (cljsTypeName.includes("Figwheel Main")) {
        return getFigwheelMainProjects();
    } else if (cljsTypeName.includes("shadow-cljs")) {
        return shadowBuilds();
    }
}

function updateInitCode(build: string, initCode): string {
    if (build && typeof initCode === 'object') {
        if (build.charAt(0) == ":") {
            return initCode.build.replace("%BUILD%", build);
        } else {
            return initCode.repl.replace("%REPL%", build);
        }
    } else if (build && typeof initCode === 'string') {
        return initCode.replace("%BUILD%", `"${build}"`);
    }
    return null;
}

function createCLJSReplType(cljsType: CustomCljsType): ReplType {
    let appURL: string;
    const cljsTypeName = cljsType.name,
        chan = state.outputChannel(),
        printThisPrinter: processOutputFn = x => {
            if (cljsType.printThisLineRegExp) {
                if (x.search(cljsType.printThisLineRegExp) >= 0) {
                    chan.appendLine(x.replace(/\s*$/, ""));
                }
            }
        },
        startAppNowProcessor: processOutputFn = x => {
            if (cljsType.openUrlRegExp) {
                let matched = util.stripAnsi(x).match(cljsType.openUrlRegExp);
                if (matched && matched.length > 1) {
                    appURL = matched[1];
                }
            }
            if (cljsType.isReadyToStartRegExp) {
                if (x.search(cljsType.isReadyToStartRegExp) >= 0) {
                    chan.appendLine("CLJS REPL ready to connect. Please, start your ClojureScript app.");
                    if (appURL) {
                        if (cljsType.shouldOpenURL) {
                            chan.appendLine(`  Opening ClojureScript app in the browser at: ${appURL} ...`);
                            open(appURL).catch(reason => {
                                chan.appendLine("Error opening ClojureScript app in the browser: " + reason);
                            });
                        } else {
                            chan.appendLine("  Open the app on this URL: " + appURL);
                        }
                    }
                    chan.appendLine("  The CLJS REPL will connect when your app is running.");
                }
            }
        },
        allPrinter: processOutputFn = x => {
            chan.appendLine(util.stripAnsi(x).replace(/\s*$/, ""));
        }

    let replType: ReplType = {
        name: cljsTypeName,
        connect: async (session, name, checkFn) => {
            state.extensionContext.workspaceState.update('cljsReplTypeHasBuilds', !(cljsType.builds === undefined));
            let initCode = cljsType.connectCode;
            let build: string = null;

            if (cljsType.builds != undefined && 
                cljsType.builds.length === 0 && 
                (typeof initCode === 'object' || initCode.includes("%BUILD%"))) {
                let projects = await figwheelOrShadowBuilds(cljsTypeName);
                build = await util.quickPickSingle({
                    values: projects,
                    placeHolder: "Select which build to connect to",
                    saveAs: `${getProjectRoot()}/${cljsTypeName.replace(" ", "-")}-build`
                });

                initCode = updateInitCode(build, initCode);

                if (!initCode) {
                    //TODO error message
                    return;
                }
            }

            if (!(typeof initCode == 'string')) {
                //TODO error message
                return;
            }

            state.cursor.set('cljsBuild', null);

            return evalConnectCode(session, initCode, name, checkFn, [startAppNowProcessor, printThisPrinter], [allPrinter]);
        },
        connected: (result, out, err) => {            
            if (cljsType.isConnectedRegExp) {
                return [...out, result].find(x => { return x.search(cljsType.isConnectedRegExp) >= 0 }) != undefined;
            } else {
                return true;
            }
        }
    };

    if (cljsType.startCode) {
        replType.start = async (session, name, checkFn) => {
            let startCode = cljsType.startCode;

            let builds: string[];

            let outputProcessors: processOutputFn[];

            if (startCode.includes("%BUILDS")) {
                let projects = await figwheelOrShadowBuilds(cljsTypeName);
                builds = projects.length <= 1 ? projects : await util.quickPickMulti({
                    values: projects,
                    placeHolder: "Please select which builds to start",
                    saveAs: `${getProjectRoot()}/${cljsTypeName.replace(" ", "-")}-projects`
                });

                if (builds) {
                    state.extensionContext.workspaceState.update('cljsReplTypeHasBuilds', true);
                    state.cursor.set('cljsBuild', builds[0]);
                    startCode = startCode.replace("%BUILDS%", builds.map(x => { return `"${x}"` }).join(" "));
                    return evalConnectCode(session, startCode, name, checkFn, [startAppNowProcessor, printThisPrinter], [allPrinter]);
                } else {
                    chan.appendLine("Starting REPL for " + cljsTypeName + " aborted.");
                    throw "Aborted";
                }
            } else {
                return evalConnectCode(session, startCode, name, checkFn, [startAppNowProcessor, printThisPrinter], [allPrinter]);
            }
        };
    }

    replType.started = (result, out, err) => {
        if (cljsType.isReadyToStartRegExp) {
            return [...out, ...err].find(x => { return x.search(cljsType.isReadyToStartRegExp) >= 0 }) != undefined;
        } else {
            return true;
        }
    }

    return replType;
}

async function makeCljsSessionClone(session, replType, repl: ReplType) {
    let chan = state.outputChannel();

    chan.appendLine("Creating cljs repl session...");
    let newCljsSession = await session.clone();
    if (newCljsSession) {
        chan.show(true);
        state.extensionContext.workspaceState.update('cljsReplType', replType);
        state.analytics().logEvent("REPL", "ConnectingCLJS", replType).send();
        chan.appendLine("Connecting CLJS repl: " + repl.name + "...");
        chan.appendLine("See Calva Connection Log for detailed progress updates.");
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

async function promptForNreplUrlAndConnect(port, cljsTypeName, connectSequence: ReplConnectSequence) {
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
            await connectToHost(hostname, parsedPort, cljsTypeName, connectSequence);
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

export function nreplPortFile(subPath: string): string {
    try {
        return path.resolve(getProjectRoot(), subPath);
    } catch (e) {
        console.log(e);
    }
    return subPath;
}

export async function connect(connectSequence: ReplConnectSequence, isAutoConnect = false, isJackIn = false) {
    let chan = state.outputChannel();
    let cljsTypeName: string;

    state.analytics().logEvent("REPL", "ConnectInitiated", isAutoConnect ? "auto" : "manual");

    if (connectSequence.cljsType == undefined) {
        cljsTypeName = "";
    } else if (typeof connectSequence.cljsType == "string") {
        cljsTypeName = connectSequence.cljsType;
    } else {
        cljsTypeName = connectSequence.cljsType.name;
    }

    state.analytics().logEvent("REPL", "ConnnectInitiated", cljsTypeName).send();

    console.log("connect", { connectSequence, cljsTypeName });

    const portFile: string = await Promise.resolve(cljsTypeName === "shadow-cljs" ? nreplPortFile(".shadow-cljs/nrepl.port") : nreplPortFile(".nrepl-port"));

    state.extensionContext.workspaceState.update('selectedCljsTypeName', cljsTypeName);
    state.extensionContext.workspaceState.update('selectedConnectSequence', connectSequence);

    if (fs.existsSync(portFile)) {
        let port = fs.readFileSync(portFile, 'utf8');
        if (port) {
            if (isAutoConnect) {
                state.cursor.set("hostname", "localhost");
                state.cursor.set("port", port);
                await connectToHost("localhost", port, cljsTypeName, connectSequence);
            } else {
                await promptForNreplUrlAndConnect(port, cljsTypeName, connectSequence);
            }
        } else {
            chan.appendLine('No nrepl port file found. (Calva does not start the nrepl for you, yet.)');
            await promptForNreplUrlAndConnect(port, cljsTypeName, connectSequence);
        }
    } else {
        await promptForNreplUrlAndConnect(null, cljsTypeName, connectSequence);
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
        const cljsTypeName: string = state.extensionContext.workspaceState.get('selectedCljsTypeName');
        const connectSequence: ReplConnectSequence = state.extensionContext.workspaceState.get('selectedConnectSequence');
        let cljsType: CustomCljsType = typeof connectSequence.cljsType == "string" ? getDefaultCljsType(cljsTypeName) : connectSequence.cljsType;
        let translatedReplType = createCLJSReplType(cljsType);

        let [session, shadowBuild] = await makeCljsSessionClone(cljSession, cljsTypeName, translatedReplType);
        if (session)
            await setUpCljsRepl(session, chan, shadowBuild);
        status.update();
    }
};
