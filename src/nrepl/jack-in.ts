import * as vscode from "vscode";
import * as utilities from "../utilities";
import * as fs from "fs";
import * as path from "path";
import * as state from "../state"
import * as connector from "../connector";
import { nClient } from "../connector";
import statusbar from "../statusbar";
import { askForConnectSequence, ReplConnectSequence, CljsTypes } from "./connectSequence";
import * as projectTypes from './project-types';
import * as outputWindow from '../results-output/results-doc';
import { JackInTerminal, JackInTerminalOptions } from "./jack-in-terminal";
import * as namespace from "../namespace";
import * as liveShareSupport from '../liveShareSupport';

let jackInPTY: JackInTerminal = undefined;
let jackInTerminal: vscode.Terminal = undefined;

let watcher: fs.FSWatcher;

function cancelJackInTask() {
    setTimeout(() => {
        calvaJackout();
    }, 1000);
}

async function executeJackInTask(projectType: projectTypes.ProjectType, projectTypeSelection: any, executable: string, args: any, isWin: boolean, cljTypes: string[], connectSequence: ReplConnectSequence) {
    utilities.setLaunchingState(projectTypeSelection);
    statusbar.update();
    const nReplPortFile = projectTypes.nreplPortFileLocalPath(connectSequence);
    const env = Object.assign(process.env, state.config().jackInEnv) as {
        [key: string]: string;
    };
    const terminalOptions: JackInTerminalOptions = {
        name: `Calva Jack-in: ${connectSequence.name}`,
        executable,
        args,
        env,
        isWin,
        cwd: state.getProjectRootLocal(),
    };

    // in case we have a running task present try to end it.
    calvaJackout();
    if (jackInTerminal !== undefined) {
        jackInTerminal.dispose();
        jackInTerminal = undefined;
    }

    state.analytics().logEvent("REPL", "JackInExecuting", JSON.stringify(cljTypes)).send();

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
        return
    }
    state.analytics().logEvent("REPL", "JackInInitiated").send();
    await outputWindow.initResultsDoc();
    outputWindow.append("; Jacking in...");
    const outputDocument = await outputWindow.openResultsDoc();

    const cljTypes: string[] = await projectTypes.detectProjectTypes();
    if (cljTypes.length > 1) {
        const projectConnectSequence: ReplConnectSequence = await askForConnectSequence(cljTypes.filter(t => t !== 'generic'), 'jack-in-type', "JackInInterrupted");

        if (!projectConnectSequence) {
            state.analytics().logEvent("REPL", "JackInInterrupted", "NoProjectTypeForBuildName").send();
            outputWindow.append("; Aborting Jack-in, since no project type was selected.");
            return;
        }
        if (projectConnectSequence.projectType !== 'generic') {
            const projectTypeName: string = projectConnectSequence.projectType;
            let selectedCljsType: CljsTypes;

            if (typeof projectConnectSequence.cljsType == "string" && projectConnectSequence.cljsType != CljsTypes.none) {
                selectedCljsType = projectConnectSequence.cljsType;
            } else if (projectConnectSequence.cljsType && typeof projectConnectSequence.cljsType == "object") {
                selectedCljsType = projectConnectSequence.cljsType.dependsOn;
            }

            let projectType = projectTypes.getProjectTypeForName(projectTypeName);
            let executable = projectTypes.isWin ? projectType.winCmd : projectType.cmd;
            // Ask the project type to build up the command line. This may prompt for further information.
            let args = await projectType.commandLine(projectConnectSequence, selectedCljsType);

            executeJackInTask(projectType, projectConnectSequence.name, executable, args, projectTypes.isWin, cljTypes, projectConnectSequence)
                .then(() => { }, () => { });
        } else {
            outputWindow.append("; There is no Jack-in possible for this project type.");
        }
    } else { // Only 'generic' type left
        outputWindow.append("; No Jack-in possible.");
        vscode.window.showInformationMessage('No supported Jack-in project types detected. Maybe try starting your project manually and use the Connect command?')
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
        if(namespace.getSession("clj")) {
            commands["Open the Output Window"] = "calva.showOutputWindow";
        }
    }

    vscode.window.showQuickPick([...Object.keys(commands)]).then(v => {
        if (commands[v]) {
            vscode.commands.executeCommand(commands[v]);
        }
    })
}
