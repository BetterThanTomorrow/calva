import * as vscode from "vscode";
import * as utilities from "../utilities";
import * as _ from "lodash";
import * as state from "../state"
import * as connector from "../connector";
import { nClient } from "../connector";
import statusbar from "../statusbar";
import { askForConnectSequence, ReplConnectSequence, CljsTypes } from "./connectSequence";
import * as projectTypes from './project-types';
import * as outputWindow from '../results-output/results-doc';
import { JackInTerminal, JackInTerminalOptions, createTerminalCommand } from "./jack-in-terminal";
import * as namespace from "../namespace";
import * as liveShareSupport from '../liveShareSupport';

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

function getJackInEnv(): any {
    return {
        ...process.env,
        ..._.mapValues(state.config().jackInEnv as object, resolveEnvVariables)
    };
}

async function executeJackInTask(terminalOptions: JackInTerminalOptions, connectSequence: ReplConnectSequence) {
    utilities.setLaunchingState(connectSequence.name);
    statusbar.update();

    // in case we have a running task present try to end it.
    calvaJackout();
    if (jackInTerminal !== undefined) {
        jackInTerminal.dispose();
        jackInTerminal = undefined;
    }

    try {
        jackInPTY = new JackInTerminal(terminalOptions, async (_p, hostname: string, port: string) => {
            // Create a watcher to wait for the nREPL port file to appear with new content, and connect + open the repl window at that point.
            utilities.setLaunchingState(null);
            await connector.connect(connectSequence, true, hostname, port);
            outputWindow.append("; Jack-in done.");
            outputWindow.appendPrompt();
        }, (errorMessage) => {
            outputWindow.append("; Error in Jack-in: unable to read port file");
            outputWindow.append(`; ${errorMessage}`);
            outputWindow.append("; You may have chosen the wrong jack-in configuration for your project.");
            vscode.window.showErrorMessage("Error in Jack-in: unable to read port file. See output window for more information.");
            cancelJackInTask();
        });
        jackInTerminal = (<any>vscode.window).createTerminal({ name: `Calva Jack-in: ${connectSequence.name}`, pty: jackInPTY });
        if (state.config().autoOpenJackInTerminal) {
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
        console.error("An error occurred while initializing project directory.", e);
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
            vscode.env.clipboard.writeText(createTerminalCommand(executable, args));
            vscode.window.showInformationMessage("Jack-in command copied to the clipboard.");
        }
    }
}

async function getJackInTerminalOptions(projectConnectSequence: ReplConnectSequence): Promise<JackInTerminalOptions> {
    if (projectConnectSequence.projectType !== 'generic') {
        const projectTypeName: string = projectConnectSequence.projectType;
        let selectedCljsType: CljsTypes;

        if (typeof projectConnectSequence.cljsType == "string" && projectConnectSequence.cljsType != CljsTypes.none) {
            selectedCljsType = projectConnectSequence.cljsType;
        } else if (projectConnectSequence.cljsType && typeof projectConnectSequence.cljsType == "object") {
            selectedCljsType = projectConnectSequence.cljsType.dependsOn;
        }

        const projectType = projectTypes.getProjectTypeForName(projectTypeName);
        const executable = projectTypes.isWin ? projectType.winCmd : projectType.cmd;
        // Ask the project type to build up the command line. This may prompt for further information.
        const args = await projectType.commandLine(projectConnectSequence, selectedCljsType);

        const terminalOptions: JackInTerminalOptions = {
            name: `Calva Jack-in: ${projectConnectSequence.name}`,
            executable,
            args,
            env: getJackInEnv(),
            isWin: projectTypes.isWin,
            cwd: state.getProjectRootLocal(),
        };
        return terminalOptions;
    }
}

async function getProjectConnectSequence(): Promise<ReplConnectSequence> {
    const cljTypes: string[] = await projectTypes.detectProjectTypes();
    if (cljTypes.length > 1) {
        const connectSequence = await askForConnectSequence(cljTypes.filter(t => t !== 'generic'), 'jack-in-type', "JackInInterrupted");
        if (connectSequence) {
            return connectSequence;
        } else {
            return Promise.reject();
        }
    } else { // Only 'generic' type left
        vscode.window.showInformationMessage('No supported Jack-in project types detected.');
    }
}

export async function calvaJackIn() {
    try {
        await state.initProjectDir();
    } catch (e) {
        console.error("An error occurred while initializing project directory.", e);
        return;
    }
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

    let projectConnectSequence: ReplConnectSequence;
    try {
        projectConnectSequence = await getProjectConnectSequence();
    } catch (e) {
        outputWindow.append('; Aborting jack-in. No project type selected.');
        return;
    }
    if (projectConnectSequence) {
        const terminalJackInOptions = await getJackInTerminalOptions(projectConnectSequence);
        if (terminalJackInOptions) {
            executeJackInTask(terminalJackInOptions, projectConnectSequence);
        }
    } else {
        outputWindow.append('; No supported project types detected.');
        return;
    }

    liveShareSupport.didJackIn();
}

export async function calvaDisconnect() {

    if (utilities.getConnectedState()) {
        connector.default.disconnect();
        return;
    } else if (utilities.getConnectingState() ||
        utilities.getLaunchingState()) {
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

export async function calvaJackInOrConnect() {

    let commands = {};
    if (!utilities.getConnectedState() &&
        !utilities.getConnectingState() &&
        !utilities.getLaunchingState()) {
        if (vscode.workspace.workspaceFolders[0].uri.scheme != "vsls") {
            commands["Start a REPL server and connect (a.k.a. Jack-in)"] = "calva.jackIn";
        }
        commands["Connect to a running REPL server in your project"] = "calva.connect";
        commands["Connect to a running REPL server, not in your project"] = "calva.connectNonProjectREPL";
    } else {
        commands["Disconnect from the REPL server"] = "calva.disconnect";
        if (namespace.getSession("clj")) {
            commands["Open the Output Window"] = "calva.showOutputWindow";
        }
    }

    vscode.window.showQuickPick([...Object.keys(commands)]).then(v => {
        if (commands[v]) {
            vscode.commands.executeCommand(commands[v]);
        }
    })
}
