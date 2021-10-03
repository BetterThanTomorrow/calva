import * as vscode from "vscode";
import * as path from "path";
import * as utilities from "../utilities";
import * as _ from "lodash";
import * as state from "../state"
import status from '../status';
import * as connector from "../connector";
import { nClient } from "../connector";
import statusbar from "../statusbar";
import { askForConnectSequence, ReplConnectSequence, CljsTypes } from "./connectSequence";
import * as projectTypes from './project-types';
import * as outputWindow from '../results-output/results-doc';
import { JackInTerminal, JackInTerminalOptions, createCommandLine } from "./jack-in-terminal";
import * as liveShareSupport from '../liveShareSupport';
import { getConfig } from '../config';

let jackInPTY: JackInTerminal = undefined;
let jackInTerminal: vscode.Terminal = undefined;

function cancelJackInTask() {
    setTimeout(() => {
        calvaJackout();
    }, 1000);
}

function resolveEnvVariables(entry: any): any {
    if (typeof (entry) === "string") {
        const s = entry.replace(/\$\{env:(\w+)\}/, (_, v) => process.env[v] ? process.env[v] : '');
        return s;
    } else {
        return entry;
    }
}

function processEnvObject(env: any){
    return _.mapValues(env, resolveEnvVariables)
}

function getGlobalJackInEnv() {
    return {
        ...process.env,
        ...processEnvObject(getConfig().jackInEnv as object)
    };
}

async function executeJackInTask(terminalOptions: JackInTerminalOptions, connectSequence: ReplConnectSequence, cb?: Function) {
    utilities.setLaunchingState(connectSequence.name);
    statusbar.update();

    // in case we have a running task present try to end it.
    calvaJackout();
    status.updateNeedReplUi(true);
    if (jackInTerminal !== undefined) {
        jackInTerminal.dispose();
        jackInTerminal = undefined;
    }

    try {
        jackInPTY = new JackInTerminal(terminalOptions, async (_p, hostname: string, port: string) => {
            utilities.setLaunchingState(null);
            await connector.connect(connectSequence, true, hostname, port);
            outputWindow.append("; Jack-in done.");
            outputWindow.appendPrompt();
            if (cb) {
                cb();
            }
        }, (errorMessage) => {
            outputWindow.append("; Error in Jack-in: unable to read port file");
            outputWindow.append(`; ${errorMessage}`);
            outputWindow.append("; You may have chosen the wrong jack-in configuration for your project.");
            vscode.window.showErrorMessage("Error in Jack-in: unable to read port file. See output window for more information.");
            cancelJackInTask();
        });
        jackInTerminal = (<any>vscode.window).createTerminal({ name: `Calva Jack-in: ${connectSequence.name}`, pty: jackInPTY });
        if (getConfig().autoOpenJackInTerminal) {
            jackInTerminal.show();
        }
        jackInPTY.onDidClose((e) => {
            calvaJackout();
        });
    } catch (exception) {
        console.error("Failed executing task: ", exception.message);
    }
}

export function calvaJackout() {
    if (jackInPTY != undefined) {
        if (projectTypes.isWin) {
            // this is a hack under Windows to terminate the
            // repl process from the repl client because the
            // ShellExecution under Windows will not terminate
            // all child processes.
            //
            // the clojure code to terminate the repl process
            // was taken from this comment on github:
            //
            // https://github.com/clojure-emacs/cider/issues/390#issuecomment-317791387
            //
            if (nClient && nClient.session) {
                nClient.session.eval("(do (.start (Thread. (fn [] (Thread/sleep 5000) (shutdown-agents) (System/exit 0)))) nil)", 'user');
            }
        }
        connector.default.disconnect();
        jackInPTY.killProcess();
        jackInPTY = undefined;
        utilities.setLaunchingState(null);
        statusbar.update();
    }

    liveShareSupport.didJackOut();
}

export async function copyJackInCommandToClipboard(): Promise<void> {
    try {
        await state.initProjectDir();
    } catch (e) {
        console.error('An error occurred while initializing project directory.', e);
        return;
    }
    let projectConnectSequence: ReplConnectSequence;
    try {
        projectConnectSequence = await getProjectConnectSequence();
    } catch (e) {
        return;
    }
    if (projectConnectSequence) {
        const { executable, args } = await getJackInTerminalOptions(projectConnectSequence);
        if (executable && args) {
            vscode.env.clipboard.writeText(createCommandLine(executable, args));
            vscode.window.showInformationMessage('Jack-in command copied to the clipboard.');
        }
    } else {
        vscode.window.showInformationMessage('No supported project types detected.');
    }
}

async function getJackInTerminalOptions(projectConnectSequence: ReplConnectSequence): Promise<JackInTerminalOptions> {
    const projectTypeName: string = projectConnectSequence.projectType;
    let selectedCljsType: CljsTypes;

    if (typeof projectConnectSequence.cljsType == "string" && projectConnectSequence.cljsType != CljsTypes.none) {
        selectedCljsType = projectConnectSequence.cljsType;
    } else if (projectConnectSequence.cljsType && typeof projectConnectSequence.cljsType == "object") {
        selectedCljsType = projectConnectSequence.cljsType.dependsOn;
    }

    const projectType = projectTypes.getProjectTypeForName(projectTypeName);
    let executable: string;
    let args: string[] = await projectType.commandLine(projectConnectSequence, selectedCljsType);
    let cmd: string[];
    if (projectTypes.isWin) {
        cmd = projectType.winCmd;
        if (projectType.resolveBundledPathWin) {
            const jarSourceUri = vscode.Uri.file(path.join(state.extensionContext.extensionPath, 'deps.clj.jar')); 
            const jarDestUri = vscode.Uri.file(path.join(state.getProjectRootLocal(), '.calva', 'deps.clj.jar')); 
            try {
                await vscode.workspace.fs.copy(jarSourceUri, jarDestUri, { overwrite: false });
            } catch { }        
            cmd = [...cmd, projectType.resolveBundledPathWin()]; 
        }
    } else {
        cmd = projectType.cmd;
        if (projectType.resolveBundledPathUnix) {
            cmd = [...cmd, projectType.resolveBundledPathUnix()]; 
        }
    }
    executable = cmd[0];
    args = [...cmd.slice(1), ...args];

    const terminalOptions: JackInTerminalOptions = {
        name: `Calva Jack-in: ${projectConnectSequence.name}`,
        executable,
        args,
        env: { 
            ...getGlobalJackInEnv(), 
            ...processEnvObject(projectConnectSequence.jackInEnv)
        },
        isWin: projectTypes.isWin,
        cwd: state.getProjectRootLocal(),
        useShell: projectTypes.isWin ? projectType.processShellWin : projectType.processShellUnix
    };
    return terminalOptions;
}

async function getProjectConnectSequence(): Promise<ReplConnectSequence> {
    const cljTypes: string[] = await projectTypes.detectProjectTypes();
    if (cljTypes.length > 1) {
        const connectSequence = await askForConnectSequence(cljTypes.filter(t => !['generic', 'cljs-only'].includes(t)), 'jack-in-type', "JackInInterrupted");
        if (connectSequence) {
            return connectSequence;
        } else {
            return Promise.reject();
        }
    }
}

export async function jackIn(connectSequence: ReplConnectSequence, cb?: Function) {
    try {
        await liveShareSupport.setupLiveShareListener();
    } catch (e) {
        console.error("An error occurred while setting up Live Share listener.", e);
    }
    if (state.getProjectRootUri().scheme === "vsls") {
        outputWindow.append("; Aborting Jack-in, since you're the guest of a live share session.");
        outputWindow.append("; Please use this command instead: Connect to a running REPL server in the project.");
        return;
    }
    state.analytics().logEvent("REPL", "JackInInitiated").send();
    await outputWindow.initResultsDoc();
    outputWindow.append("; Jacking in...");
    await outputWindow.openResultsDoc();

    let projectConnectSequence: ReplConnectSequence = connectSequence;
    if (!projectConnectSequence) {
        try {
            projectConnectSequence = await getProjectConnectSequence();
        } catch (e) {
            outputWindow.append('; Aborting jack-in. No project type selected.');
            return;
        }
    }
    if (projectConnectSequence) {
        const terminalJackInOptions = await getJackInTerminalOptions(projectConnectSequence);
        if (terminalJackInOptions) {
            await executeJackInTask(terminalJackInOptions, projectConnectSequence, cb);
        }
    } else {
        vscode.window.showInformationMessage('No supported project types detected. Maybe try starting your project manually and use the Connect command?');
        return;
    }

    liveShareSupport.didJackIn();
}

export async function jackInCommand(connectSequence?: ReplConnectSequence) {
    status.updateNeedReplUi(true);
    try {
        await state.initProjectDir();
    } catch (e) {
        console.error("An error occurred while initializing project directory.", e);
        return;
    }
    await jackIn(connectSequence);
}

export async function calvaDisconnect() {
    if (utilities.getConnectedState()) {
        connector.default.disconnect();
        return;
    } else if (utilities.getConnectingState() || utilities.getLaunchingState()) {
        vscode.window.showInformationMessage(
            "Do you want to interrupt the connection process?",
            { modal: true },
            ...["Ok"]).then((value) => {
                if (value == 'Ok') {
                    calvaJackout();
                    connector.default.disconnect();
                    utilities.setLaunchingState(null);
                    utilities.setConnectingState(false);
                    statusbar.update();
                    outputWindow.append("; Interrupting Jack-in process.");
                }
            });
        return;
    }
    vscode.window.showInformationMessage("Not connected to a REPL server");
}
