import * as vscode from "vscode";
import * as utilities from "../utilities";
import * as fs from "fs";
import * as path from "path";
import * as state from "../state"
import * as connector from "../connector";
import {nClient, cljSession, cljsSession} from "../connector";
import statusbar from "../statusbar";
import { askForConnectSequence, ReplConnectSequence, CljsTypes } from "./connectSequence";
import * as projectTypes from './project-types';
import { isReplWindowOpen, openReplWindow } from "../repl-window";

let JackinExecution:vscode.TaskExecution = undefined;

let watcher: fs.FSWatcher;
const TASK_NAME = "Calva Jack-in";

vscode.tasks.onDidStartTask(((e) => {
    if(e.execution.task.name == TASK_NAME) {
        JackinExecution = e.execution;
    }
}));

vscode.tasks.onDidEndTask(((e) => {
    if(e.execution.task.name == TASK_NAME) {
       JackinExecution = undefined;
       connector.default.disconnect();
       // make sure everything is set back 
       // even if the task failed to connect
       // to the repl server.
       utilities.setLaunchingState(null);
       statusbar.update();
    }
}));

function cancelJackInTask() {
    setTimeout(() => {
        calvaJackout(); 
    }, 1000);
}

async function executeJackInTask(projectType: projectTypes.ProjectType, projectTypeSelection: any, executable: string, args: any, cljTypes: string[], outputChannel: vscode.OutputChannel, connectSequence: ReplConnectSequence) {
    utilities.setLaunchingState(projectTypeSelection);
    statusbar.update();
    const nReplPortFile = projectTypes.nreplPortFile(connectSequence);
    const env = { ...process.env, ...state.config().jackInEnv } as {
        [key: string]: string;
    };
    const execution = projectTypes.isWin ?
        new vscode.ProcessExecution(executable, args, {
            cwd: state.getProjectRoot(),
            env: env,
        }) :
        new vscode.ShellExecution(executable, args, {
            cwd: state.getProjectRoot(),
            env: env,
        });
    const taskDefinition: vscode.TaskDefinition = {
        type: projectTypes.isWin ? "process" : "shell",
        label: "Calva: Jack-in"
    };
    const task = new vscode.Task(taskDefinition, state.getProjectWsFolder(), TASK_NAME, "Calva", execution);

    state.analytics().logEvent("REPL", "JackInExecuting", JSON.stringify(cljTypes)).send();

    // in case we have a running task present try to end it.
    calvaJackout();

    vscode.tasks.executeTask(task).then((v) => {
        // Create a watcher to wait for the nREPL port file to appear with new content, and connect + open the repl window at that point.
        const portFileDir = path.dirname(nReplPortFile),
            portFileBase = path.basename(nReplPortFile);
        if (watcher != undefined) {
            watcher.removeAllListeners();
        }

        if(!fs.existsSync(portFileDir)) {
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
        } catch(exception) {
            outputChannel.appendLine("Error in Jack-in: unable to read port file");
            outputChannel.appendLine(exception);
            outputChannel.appendLine("You may have choosen the wrong jack-in configuration for your project.");
            vscode.window.showErrorMessage("Error in Jack-in: unable to read port file. See output channel for more information.");
            cancelJackInTask();
        }
    }, (reason) => {
        watcher.removeAllListeners();
        outputChannel.appendLine("Error in Jack-in: ");
        outputChannel.appendLine(reason);
        vscode.window.showErrorMessage("Error in Jack-in. See output channel for more information.");
        cancelJackInTask();
    });
}

export function calvaJackout() {
    if (JackinExecution != undefined) {
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
                nClient.session.eval("(do (.start (Thread. (fn [] (Thread/sleep 5000) (shutdown-agents) (System/exit 0)))) nil)");
            }
        }
        JackinExecution.terminate();
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

    const cljTypes = await projectTypes.detectProjectTypes();
    const projectConnectSequence: ReplConnectSequence = await askForConnectSequence(cljTypes, 'jack-in-type', "JackInInterrupted");
    
    if (!projectConnectSequence) {
        state.analytics().logEvent("REPL", "JackInInterrupted", "NoProjectTypeForBuildName").send();
        outputChannel.appendLine("Aborting Jack-in, since no project typee was selected.");
        return;
    }
    
    outputChannel.appendLine("Jacking in...");

    const projectTypeName: string = projectConnectSequence.projectType;
    let selectedCljsType: CljsTypes;

    if (typeof projectConnectSequence.cljsType == "string") {
        selectedCljsType = projectConnectSequence.cljsType;
    } else if (projectConnectSequence.cljsType) {
        selectedCljsType = projectConnectSequence.cljsType.dependsOn;
    }

    let projectType = projectTypes.getProjectTypeForName(projectTypeName);
    let executable = projectTypes.isWin ? projectType.winCmd : projectType.cmd;
    // Ask the project type to build up the command line. This may prompt for further information.
    let args = await projectType.commandLine(projectConnectSequence, selectedCljsType);

    executeJackInTask(projectType, projectConnectSequence.name, executable, args, cljTypes, outputChannel, projectConnectSequence)
        .then(() => { }, () => { });
}

export async function calvaDisconnect() {

    if (utilities.getConnectedState()) {
        calvaJackout();
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
        if(utilities.getSession("clj") && !isReplWindowOpen("clj")) {
            commands["Open the Clojure REPL Window"] = "calva.openCljReplWindow";
        }
        if(utilities.getSession("cljs") && !isReplWindowOpen("cljs"))  {
            commands["Open the ClojureScript REPL Window"] = "calva.openCljsReplWindow";
        }
    }

    vscode.window.showQuickPick([...Object.keys(commands)]).then(v => {
        if(commands[v]) {
            vscode.commands.executeCommand(commands[v]);
        }
    })
}


