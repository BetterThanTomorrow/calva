import * as vscode from "vscode";
import * as utilities from "../utilities";
import * as fs from "fs";
import * as path from "path";
import * as state from "../state"
import * as connector from "../connector";
import statusbar from "../statusbar";
import { parseEdn, parseForms } from "../../cljs-out/cljs-lib";
import { askForConnectSequence, ReplConnectSequence, CljsTypes } from "./connectSequence";
import { stringify } from "querystring";
import * as projectTypes from './project-types';

let watcher: fs.FSWatcher;
const TASK_NAME = "Calva Jack-in";

async function executeJackInTask(projectType: projectTypes.ProjectType, projectTypeSelection: any, executable: string, args: any, cljTypes: string[], outputChannel: vscode.OutputChannel, connectSequence: ReplConnectSequence) {
    state.cursor.set("launching", projectTypeSelection);
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

    vscode.tasks.executeTask(task).then((v) => {
        // Create a watcher to wait for the nREPL port file to appear with new content, and connect + open the repl window at that point.
        const portFileDir = path.dirname(nReplPortFile),
            portFileBase = path.basename(nReplPortFile);
        if (watcher != undefined) {
            watcher.removeAllListeners();
        }

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
                state.cursor.set("launching", null);
                watcher.removeAllListeners();
                await connector.connect(connectSequence, true, true);
                chan.appendLine("Jack-in done. Use the VS Code task management UI to control the life cycle of the Jack-in task.");
            }
        });
    }, (reason) => {
        watcher.removeAllListeners();
        outputChannel.appendLine("Error in Jack-in: " + reason);
    });
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
    state.extensionContext.workspaceState.update('selectedCljTypeName', projectConnectSequence.projectType);
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
