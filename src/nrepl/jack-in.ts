import * as vscode from "vscode";
import * as utilities from "../utilities";
import * as fs from "fs";
import * as path from "path";
import * as state from "../state"
import * as connector from "../connector";
import { nClient, cljSession, cljsSession } from "../connector";
import statusbar from "../statusbar";
import { askForConnectSequence, ReplConnectSequence, CljsTypes } from "./connectSequence";
import * as projectTypes from './project-types';
import { isReplWindowOpen } from "../repl-window";
import { JackInTerminal, JackInTerminalOptions } from "./jack-in-terminal";

let jackInPTY: JackInTerminal = undefined;
let jackInTerminal: vscode.Terminal = undefined;

let watcher: fs.FSWatcher;

function cancelJackInTask() {
    setTimeout(() => {
        calvaJackout();
    }, 1000);
}

async function executeJackInTask(projectType: projectTypes.ProjectType, projectTypeSelection: any, executable: string, args: any, isWin: boolean, cljTypes: string[], outputChannel: vscode.OutputChannel, connectSequence: ReplConnectSequence) {
    utilities.setLaunchingState(projectTypeSelection);
    statusbar.update();
    const nReplPortFile = projectTypes.nreplPortFile(connectSequence);
    const env = Object.assign(process.env, state.config().jackInEnv) as {
        [key: string]: string;
    };
    const terminalOptions: JackInTerminalOptions = {
        name: `Calva Jack-in: ${connectSequence.name}`,
        executable,
        args,
        env,
        isWin,
        cwd: state.getProjectRoot(),
    };

    // in case we have a running task present try to end it.
    calvaJackout();
    if (jackInTerminal !== undefined) {
        jackInTerminal.dispose();
        jackInTerminal = undefined;
    }

    state.analytics().logEvent("REPL", "JackInExecuting", JSON.stringify(cljTypes)).send();

    try {
        jackInPTY = new JackInTerminal(terminalOptions, outputChannel, (p) => {
            // Create a watcher to wait for the nREPL port file to appear with new content, and connect + open the repl window at that point.
            const portFileDir = path.dirname(nReplPortFile),
                portFileBase = path.basename(nReplPortFile);
            if (watcher != undefined) {
                watcher.removeAllListeners();
            }
            console.log("executeTask: " + nReplPortFile);

            if (!fs.existsSync(portFileDir)) {
                // try to make the directory to allow the
                // started process to catch up.
                fs.mkdirSync(portFileDir);
            }

            try {
                watcher = fs.watch(portFileDir, async (eventType, fileName) => {
                    if (fileName == portFileBase) {
                        if (!fs.existsSync(nReplPortFile)) {
                            return;
                        }
                        const port = fs.readFileSync(nReplPortFile, 'utf8');
                        if (!port) { // On Windows we get two events, one for file creation and one for the change of content
                            return;  // If there is no port to be read yet, wait for the next event instead.
                        }
                        const chan = state.outputChannel();
                        setTimeout(() => { chan.show() }, 1000);
                        utilities.setLaunchingState(null);
                        watcher.removeAllListeners();
                        await connector.connect(connectSequence, true, true);
                        chan.appendLine("Jack-in done.");
                    }
                });
            } catch (exception) {
                outputChannel.appendLine("Error in Jack-in: unable to read port file");
                outputChannel.appendLine(exception);
                outputChannel.appendLine("You may have chosen the wrong jack-in configuration for your project.");
                vscode.window.showErrorMessage("Error in Jack-in: unable to read port file. See output channel for more information.");
                cancelJackInTask();
            }
        });
        jackInTerminal = (<any>vscode.window).createTerminal({ name: `Calva Jack-in: ${connectSequence.name}`, pty: jackInPTY });
        jackInTerminal.show();
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
}

export async function calvaJackIn() {
    const outputChannel = state.outputChannel();
    try {
        await state.initProjectDir();
    } catch {
        return;
    }
    state.analytics().logEvent("REPL", "JackInInitiated").send();

    const cljTypes: string[] = await projectTypes.detectProjectTypes();
    if (cljTypes.length > 1) {
        const projectConnectSequence: ReplConnectSequence = await askForConnectSequence(cljTypes.filter(t => t !== 'generic'), 'jack-in-type', "JackInInterrupted");

        if (!projectConnectSequence) {
            state.analytics().logEvent("REPL", "JackInInterrupted", "NoProjectTypeForBuildName").send();
            outputChannel.appendLine("Aborting Jack-in, since no project type was selected.");
            return;
        }
        if (projectConnectSequence.projectType !== 'generic') {
            outputChannel.appendLine("Jacking in...");

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

            executeJackInTask(projectType, projectConnectSequence.name, executable, args, projectTypes.isWin, cljTypes, outputChannel, projectConnectSequence)
                .then(() => { }, () => { });
        } else {
            outputChannel.appendLine("There is no Jack-in possible for this project type.");
        }
    } else { // Only 'generic' type left
        outputChannel.appendLine("No Jack-in possible.");
        vscode.window.showInformationMessage('No supported Jack-in project types detected. Maybe try starting your project manually and use the Connect command?')
    }

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
                    const outputChannel = state.outputChannel();
                    calvaJackout();
                    connector.default.disconnect();
                    utilities.setLaunchingState(null);
                    utilities.setConnectingState(false);
                    statusbar.update();
                    outputChannel.appendLine("Interrupting Jack-in process.");
                    outputChannel.show();
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
        // if not connected add the connect commands
        commands["Start a REPL server and connect (a.k.a. Jack-in)"] = "calva.jackIn";
        commands["Connect to a running REPL server in your project"] = "calva.connect";
        commands["Connect to a running REPL server, not in your project"] = "calva.connectNonProjectREPL";
    } else {
        // if connected add the disconnect command and the
        // REPL window open commands if needed.
        commands["Disconnect from the REPL server"] = "calva.disconnect";
        if (utilities.getSession("clj")) {
            if (!isReplWindowOpen("clj")) {
                commands["Open the Clojure REPL Window"] = "calva.openCljReplWindow";
            } else {
                commands["Clear Clojure REPL Window + History"] = "calva.clearClojureREPLWindow";
            }

        }
        if (utilities.getSession("cljs")) {
            if (!isReplWindowOpen("cljs")) {
                commands["Open the ClojureScript REPL Window"] = "calva.openCljsReplWindow";
            } else {
                commands["Clear ClojureScript REPL Window + History"] = "calva.clearClojureScriptREPLWindow";
            }
        }
    }

    vscode.window.showQuickPick([...Object.keys(commands)]).then(v => {
        if (commands[v]) {
            vscode.commands.executeCommand(commands[v]);
        }
    })
}


