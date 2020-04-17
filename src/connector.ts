import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as fs from 'fs';
import * as state from './state';
import * as util from './utilities';
import * as open from 'open';
import status from './status';
import * as projectTypes from './nrepl/project-types';
import { NReplClient, NReplSession } from "./nrepl";
import { openReplWindow, sendTextToREPLWindow, createReplWindow } from './repl-window';
import { CljsTypeConfig, ReplConnectSequence, getDefaultCljsType, CljsTypes, askForConnectSequence } from './nrepl/connectSequence';
import { disabledPrettyPrinter } from './printer';
import { keywordize } from './util/string';
import { REQUESTS } from './debugger/calva-debug';
import debugDecorations from './debugger/decorations';

async function createAndConnectReplWindow(session: NReplSession, mode: "clj" | "cljs", ): Promise<void> {
    if (state.config().openREPLWindowOnConnect) {
        return createReplWindow(session, mode).then(w => {
            return openReplWindow(mode, true).then(w => {
                return w.reconnect().catch(e => {
                    console.error(`Failed reconnecting ${mode} REPL window: `, e);
                });
            }).catch(e => {
                console.error(`Failed to open ${mode} REPL window: `, e);
            });
        }).catch(e => {
            console.error(`Failed to create ${mode} REPL window: `, e);
        });
    }
}

async function connectToHost(hostname, port, connectSequence: ReplConnectSequence) {
    state.analytics().logEvent("REPL", "Connecting").send();

    let chan = state.outputChannel();
    if (nClient) {
        nClient["silent"] = true;
        nClient.close();
    }
    cljsSession = cljSession = null;

    util.setConnectingState(true);
    status.update();
    try {
        chan.appendLine("Hooking up nREPL sessions...");
        // Create an nREPL client. waiting for the connection to be established.
        nClient = await NReplClient.create({ host: hostname, port: +port })
        nClient.addOnCloseHandler(c => {
            util.setConnectedState(false);
            util.setConnectingState(false);
            if (!c["silent"]) // we didn't deliberately close this session, mention this fact.
                chan.appendLine("nREPL Connection was closed");
            status.update();
        })
        cljSession = nClient.session;
        chan.appendLine("Connected session: clj");
        util.setConnectingState(false);
        util.setConnectedState(true);
        state.analytics().logEvent("REPL", "ConnectedCLJ").send();
        state.cursor.set('clj', cljSession);
        state.cursor.set('cljc', cljSession);
        status.update();

        // Initialize debugger
        cljSession.initDebugger();
        chan.appendLine('Debugger initialized');
        debugDecorations.activate();

        await createAndConnectReplWindow(cljSession, "clj");

        if (connectSequence.afterCLJReplJackInCode) {
            state.outputChannel().appendLine("Evaluating `afterCLJReplJackInCode` in CLJ REPL Window");
            await sendTextToREPLWindow("clj", connectSequence.afterCLJReplJackInCode, null);
        }

        let cljsSession = null,
            cljsBuild = null;
        try {
            if (connectSequence.cljsType && connectSequence.cljsType != "none") {
                const isBuiltinType: boolean = typeof connectSequence.cljsType == "string";
                let cljsType: CljsTypeConfig = isBuiltinType ? getDefaultCljsType(connectSequence.cljsType as string) : connectSequence.cljsType as CljsTypeConfig;
                translatedReplType = createCLJSReplType(cljsType, projectTypes.getCljsTypeName(connectSequence), connectSequence);

                [cljsSession, cljsBuild] = await makeCljsSessionClone(cljSession, translatedReplType, connectSequence.name);
                state.analytics().logEvent("REPL", "ConnectCljsRepl", isBuiltinType ? connectSequence.cljsType as string : "Custom").send();
            }
            if (cljsSession) {
                await setUpCljsRepl(cljsSession, chan, cljsBuild);
            }
            chan.appendLine('cljc files will use the clj REPL.' + (cljsSession ? ' (You can toggle this at will.)' : ''));
        } catch (e) {
            chan.appendLine("Error while connecting cljs REPL: " + e);
        }
        status.update();
    } catch (e) {
        util.setConnectingState(false);
        util.setConnectedState(false);
        chan.appendLine("Failed connecting.");
        state.analytics().logEvent("REPL", "FailedConnectingCLJ").send();
        return false;
    }

    return true;
}

async function setUpCljsRepl(session, chan, build) {
    state.cursor.set("cljs", session);
    status.update();
    chan.appendLine("Connected session: cljs" + (build ? ", repl: " + build : ""));
    createAndConnectReplWindow(session, "cljs");
}

function getFigwheelMainBuilds() {
    let chan = state.outputChannel();
    let res = fs.readdirSync(state.getProjectRoot());
    let builds = res.filter(x => x.match(/\.cljs\.edn/)).map(x => x.replace(/\.cljs\.edn$/, ""));
    if (builds.length == 0) {
        vscode.window.showErrorMessage("There are no figwheel build files (.cljs.edn) in the project directory.");
        chan.appendLine("There are no figwheel build files (.cljs.edn) in the project directory.");
        chan.appendLine("Connection to Figwheel Main aborted.");
        throw "Aborted";
    }
    return builds;
}

/**
 * ! DO it later
 */
function getFigwheelBuilds() {

}

type checkConnectedFn = (value: string, out: any[], err: any[]) => boolean;
type processOutputFn = (output: string) => void;
type connectFn = (session: NReplSession, name: string, checkSuccess: checkConnectedFn) => Promise<boolean>;

async function evalConnectCode(newCljsSession: NReplSession, code: string, name: string, checkSuccess: checkConnectedFn, outputProcessors: processOutputFn[] = [], errorProcessors: processOutputFn[] = []): Promise<boolean> {
    let chan = state.connectionLogChannel();
    let err = [], out = [], result = await newCljsSession.eval(code, "user", {
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
        },
        pprintOptions: disabledPrettyPrinter
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

let translatedReplType: ReplType;

function figwheelOrShadowBuilds(cljsTypeName: string): string[] {
    if (cljsTypeName.includes("Figwheel Main")) {
        return getFigwheelMainBuilds();
    } else if (cljsTypeName.includes("shadow-cljs")) {
        return projectTypes.shadowBuilds();
    }
}

function updateInitCode(build: string, initCode): string {
    if (build && typeof initCode === 'object') {
        if (["node-repl", "browser-repl"].includes(build)) {
            return initCode.repl.replace("%REPL%", build);
        } else {
            return initCode.build.replace("%BUILD%", keywordize(build));
        }
    } else if (build && typeof initCode === 'string') {
        return initCode.replace("%BUILD%", `"${build}"`);
    }
    return null;
}

function createCLJSReplType(cljsType: CljsTypeConfig, cljsTypeName: string, connectSequence: ReplConnectSequence): ReplType {
    const projectTypeName: string = connectSequence.name,
        menuSelections = connectSequence.menuSelections;
    let appURL: string,
        haveShownStartMessage = false,
        haveShownAppURL = false,
        haveShownStartSuffix = false,
        hasStarted = cljsType.isStarted,
        useDefaultBuild = true,
        startedBuilds: string[];
    const chan = state.outputChannel(),
        // The output processors are used to keep the user informed about the connection process
        // The output from Figwheel is meant for printing to the REPL prompt,
        // and since we print to Calva says we, only print some of the messages.
        printThisPrinter: processOutputFn = x => {
            if (cljsType.printThisLineRegExp) {
                if (x.search(cljsType.printThisLineRegExp) >= 0) {
                    chan.appendLine(x.replace(/\s*$/, ""));
                }
            }
        },
        // Having and app to connect to is crucial so we do what we can to help the user
        // start the app at the right time in the process.
        startAppNowProcessor: processOutputFn = x => {
            // Extract the appURL if we have the regexp for it configured.
            if (cljsType.openUrlRegExp) {
                const matched = util.stripAnsi(x).match(cljsType.openUrlRegExp);
                if (matched && matched["groups"] && matched["groups"].url != undefined) {
                    if (matched["groups"].url != appURL) {
                        appURL = matched["groups"].url;
                        haveShownAppURL = false;
                    }
                }
            }
            // When the app is ready to start, say so.
            if (!haveShownStartMessage && cljsType.isReadyToStartRegExp) {
                if (x.search(cljsType.isReadyToStartRegExp) >= 0) {
                    chan.appendLine("CLJS REPL ready to connect. Please, start your ClojureScript app.");
                    haveShownStartMessage = true;
                }
            }
            // If we have an appURL to go with the ”start now” message, say so
            if (appURL && haveShownStartMessage && !haveShownAppURL) {
                if (cljsType.shouldOpenUrl) {
                    chan.appendLine(`  Opening ClojureScript app in the browser at: ${appURL} ...`);
                    open(appURL).catch(reason => {
                        chan.appendLine("Error opening ClojureScript app in the browser: " + reason);
                    });
                } else {
                    chan.appendLine("  Open the app on this URL: " + appURL);
                }
                haveShownAppURL = true;
            }
            // Wait for any appURL to be printed before we round of the ”start now” message.
            // (If we do not have the regexp for extracting the appURL, do not wait for appURL.)
            if (!haveShownStartSuffix && (haveShownAppURL || (haveShownStartMessage && !cljsType.openUrlRegExp))) {
                chan.appendLine("  The CLJS REPL will connect when your app is running.");
                haveShownStartSuffix = true;
            }
        },
        // This processor prints everything. We use it for stderr below.
        allPrinter: processOutputFn = x => {
            chan.appendLine(util.stripAnsi(x).replace(/\s*$/, ""));
        }

    let replType: ReplType = {
        name: cljsTypeName,
        connect: async (session, name, checkFn) => {
            state.extensionContext.workspaceState.update('cljsReplTypeHasBuilds', cljsType.buildsRequired);
            let initCode = cljsType.connectCode,
                build: string = null;
            if (menuSelections && menuSelections.cljsDefaultBuild && useDefaultBuild) {
                build = menuSelections.cljsDefaultBuild;
                useDefaultBuild = false;
            } else {
                if ((typeof initCode === 'object' || initCode.includes("%BUILD%"))) {
                    build = await util.quickPickSingle({
                        values: startedBuilds ? startedBuilds : figwheelOrShadowBuilds(cljsTypeName),
                        placeHolder: "Select which build to connect to",
                        saveAs: `${state.getProjectRoot()}/${cljsTypeName.replace(" ", "-")}-build`,
                        autoSelect: true
                    });
                }
            }

            if ((typeof build == 'string') && build != "") {
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

            state.cursor.set('cljsBuild', build);

            return evalConnectCode(session, initCode, name, checkFn, [startAppNowProcessor, printThisPrinter], [allPrinter]);
        },
        connected: (result, out, err) => {
            if (cljsType.isConnectedRegExp) {
                return [...out, result].find(x => {
                    return x.search(cljsType.isConnectedRegExp) >= 0
                }) != undefined;
            } else {
                return true;
            }
        }
    };

    if (cljsType.startCode) {
        replType.start = async (session, name, checkFn) => {
            let startCode = cljsType.startCode;
            if (!hasStarted) {
                if (startCode.includes("%BUILDS")) {
                    let builds: string[];
                    if (menuSelections && menuSelections.cljsLaunchBuilds) {
                        builds = menuSelections.cljsLaunchBuilds;
                    }
                    else {
                        const allBuilds = figwheelOrShadowBuilds(cljsTypeName);
                        builds = allBuilds.length <= 1 ? allBuilds : await util.quickPickMulti({
                            values: allBuilds,
                            placeHolder: "Please select which builds to start",
                            saveAs: `${state.getProjectRoot()}/${cljsTypeName.replace(" ", "-")}-builds`
                        });
                    }
                    if (builds) {
                        chan.appendLine("Starting cljs repl for: " + projectTypeName + "...");
                        state.extensionContext.workspaceState.update('cljsReplTypeHasBuilds', true);
                        startCode = startCode.replace("%BUILDS%", builds.map(x => { return `"${x}"` }).join(" "));
                        const result = evalConnectCode(session, startCode, name, checkFn, [startAppNowProcessor, printThisPrinter], [allPrinter]);
                        if (result) {
                            startedBuilds = builds;
                        }
                        return result;
                    } else {
                        chan.appendLine("Aborted starting cljs repl.");
                        throw "Aborted";
                    }
                } else {
                    chan.appendLine("Starting cljs repl for: " + projectTypeName + "...");
                    return evalConnectCode(session, startCode, name, checkFn, [startAppNowProcessor, printThisPrinter], [allPrinter]);
                }
            } else {
                return true;
            }
        };
    }

    replType.started = (result, out, err) => {
        if (cljsType.isReadyToStartRegExp && !hasStarted) {
            const started = [...out, ...err].find(x => {
                return x.search(cljsType.isReadyToStartRegExp) >= 0
            }) != undefined;
            if (started) {
                hasStarted = true;
            }
            return started;
        } else {
            hasStarted = true;
            return true;
        }
    }

    return replType;
}

async function makeCljsSessionClone(session, repl: ReplType, projectTypeName: string) {
    let chan = state.outputChannel();

    chan.appendLine("Creating cljs repl session...");
    let newCljsSession = await session.clone();
    if (newCljsSession) {
        chan.show(true);
        chan.appendLine("Connecting cljs repl: " + projectTypeName + "...");
        chan.appendLine("The Calva Connection Log might have more connection progress information.");
        if (repl.start != undefined) {
            if (await repl.start(newCljsSession, repl.name, repl.started)) {
                state.analytics().logEvent("REPL", "StartedCLJS", repl.name).send();
                chan.appendLine("Cljs builds started");
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
            return [cljsSession, state.deref().get('cljsBuild')];
        } else {
            let build = state.deref().get('cljsBuild')
            state.analytics().logEvent("REPL", "FailedConnectingCLJS", repl.name).send();
            let failed = "Failed starting cljs repl" + (build != null ? ` for build: ${build}. Is the build running and connected?\n   See the Output channel "Calva Connection Log" for any hints on what went wrong.` : "");
            chan.appendLine(`${failed}`);
            state.cursor.set('cljsBuild', null);
            vscode.window.showInformationMessage(
                failed,
                { modal: true },
                ...["Ok"]).then((value) => {
                    if (value == 'Ok') {
                        const outputChannel = state.connectionLogChannel();
                        outputChannel.show();
                    }
                });
        }
    }
    return [null, null];
}

async function promptForNreplUrlAndConnect(port, connectSequence: ReplConnectSequence) {
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
            await connectToHost(hostname, parsedPort, connectSequence);
        } else {
            chan.appendLine("Bad url: " + url);
            util.setConnectingState(false);
            status.update();
        }
    } else {
        util.setConnectingState(false);
        status.update();
    }
    return true;
}

export let nClient: NReplClient;
export let cljSession: NReplSession;
export let cljsSession: NReplSession;

export async function connect(connectSequence: ReplConnectSequence, isAutoConnect, isJackIn) {
    const chan = state.outputChannel(),
        cljsTypeName = projectTypes.getCljsTypeName(connectSequence);

    state.analytics().logEvent("REPL", "ConnectInitiated", isAutoConnect ? "auto" : "manual");
    state.analytics().logEvent("REPL", "ConnnectInitiated", cljsTypeName).send();

    const portFile = projectTypes.nreplPortFile(connectSequence);

    state.extensionContext.workspaceState.update('selectedCljsTypeName', cljsTypeName);
    state.extensionContext.workspaceState.update('selectedConnectSequence', connectSequence);

    if (fs.existsSync(portFile)) {
        let port = fs.readFileSync(portFile, 'utf8');
        if (port) {
            if (isAutoConnect) {
                state.cursor.set("hostname", "localhost");
                state.cursor.set("port", port);
                await connectToHost("localhost", port, connectSequence);
            } else {
                await promptForNreplUrlAndConnect(port, connectSequence);
            }
        } else {
            chan.appendLine('No nrepl port file found. (Calva does not start the nrepl for you, yet.)');
            await promptForNreplUrlAndConnect(port, connectSequence);
        }
    } else {
        await promptForNreplUrlAndConnect(null, connectSequence);
    }
    return true;
}

function standaloneConnect(connectSequence: ReplConnectSequence, chan: vscode.OutputChannel) {
    if (connectSequence) {
        const cljsTypeName = projectTypes.getCljsTypeName(connectSequence);
        chan.appendLine(`Connecting ...`);
        state.analytics().logEvent("REPL", "StandaloneConnect", `${connectSequence.name} + ${cljsTypeName}`).send();
        connect(connectSequence, false, false).catch(() => { });
    }
    else {
        chan.appendLine("Aborting connect, error determining connect sequence.");
    }
}

export default {
    connectNonProjectREPLCommand: async () => {
        const chan = state.outputChannel();
        const connectSequence = await askForConnectSequence(projectTypes.getAllProjectTypes(), 'connect-type', "ConnectInterrupted");
        standaloneConnect(connectSequence, chan);
    },
    connectCommand: async () => {
        const chan = state.outputChannel();
        // TODO: Figure out a better way to have an initialized project directory.
        try {
            await state.initProjectDir();
        } catch {
            return;
        }
        const cljTypes = await projectTypes.detectProjectTypes(),
            connectSequence = await askForConnectSequence(cljTypes, 'connect-type', "ConnectInterrupted");
        standaloneConnect(connectSequence, chan);
    },
    disconnect: (options = null, callback = () => { }) => {
        ['clj', 'cljs'].forEach(sessionType => {
            state.cursor.set(sessionType, null);
        });
        util.setConnectedState(false);
        state.cursor.set('cljc', null);
        status.update();

        if (nClient) {
            // the connection may be ended before
            // the REPL client was connected.
            nClient.close();
        }

        // If an active debug session exists, terminate it
        if (vscode.debug.activeDebugSession) {
            vscode.debug.activeDebugSession.customRequest(REQUESTS.SEND_TERMINATED_EVENT);
        }

        callback();
    },
    toggleCLJCSession: () => {
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
    switchCljsBuild: async () => {
        let cljSession = util.getSession('clj'),
            chan = state.outputChannel();
        const cljsTypeName: string = state.extensionContext.workspaceState.get('selectedCljsTypeName'),
            cljTypeName: string = state.extensionContext.workspaceState.get('selectedCljTypeName');
        state.analytics().logEvent("REPL", "switchCljsBuild", cljsTypeName).send();

        let [session, build] = await makeCljsSessionClone(cljSession, translatedReplType, cljTypeName);
        if (session) {
            await setUpCljsRepl(session, chan, build);
        }
        status.update();
    }
};