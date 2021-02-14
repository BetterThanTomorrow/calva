import * as vscode from "vscode";
import * as path from 'path';
import * as utilities from "../utilities";
import eval from '../evaluate';
import * as _ from "lodash";
import * as state from "../state"
import status from '../status';
import * as connector from "../connector";
import { nClient } from "../connector";
import statusbar from "../statusbar";
import { askForConnectSequence, ReplConnectSequence, CljsTypes, genericDefaults } from "./connectSequence";
import * as projectTypes from './project-types';
import * as outputWindow from '../results-output/results-doc';
import { JackInTerminal, JackInTerminalOptions, createCommandLine } from "./jack-in-terminal";
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
    if (projectTypes.isWin || projectType.name === 'generic') {
        if (['deps.edn', 'generic'].includes(projectType.name)) {
            const depsJarPath = path.join(state.extensionContext.extensionPath, 'deps.clj.jar')
            executable = 'java';
            args = ['-jar', depsJarPath, ...args];
        } else {
            executable = projectType.winCmd[0];
            args = [...projectType.winCmd.slice(1), ...args];
        }
    } else {
        executable = projectType.cmd[0];
        args = [...projectType.cmd.slice(1), ...args];
    }

    const terminalOptions: JackInTerminalOptions = {
        name: `Calva Jack-in: ${projectConnectSequence.name}`,
        executable,
        args,
        env: getJackInEnv(),
        isWin: projectTypes.isWin,
        cwd: state.getProjectRootLocal(),
        useShell: projectTypes.isWin ? projectType.processShellWin : projectType.processShellUnix
    };
    return terminalOptions;
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
    }
}

async function _jackIn(connectSequence: ReplConnectSequence, cb?: Function) {
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

export async function calvaJackIn(connectSequence?: ReplConnectSequence) {
    status.updateNeedReplUi(true);
    try {
        await state.initProjectDir();
    } catch (e) {
        console.error("An error occurred while initializing project directory.", e);
        return;
    }
    await _jackIn(connectSequence);
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

export const TEMPLATE_FILE_NAME = 'user.clj';
export const HELLO_TEMPLATE_FILE_NAME = 'hello-repl.clj';

export async function startStandaloneRepl(context: vscode.ExtensionContext, template: string) {
    await state.initProjectDir();
    let projectDirUri = state.getProjectRootUri();
    if (!projectDirUri) {
        projectDirUri = await state.getOrCreateNonProjectRoot(context);
    }
    await state.initProjectDir(projectDirUri);

    await vscode.workspace.fs.createDirectory(projectDirUri);
    let docName = template;
    let docUri: vscode.Uri;
    try {
        docUri = vscode.Uri.joinPath(projectDirUri, docName); 
    } catch {
        docUri = vscode.Uri.file(path.join(projectDirUri.fsPath, docName));
    }

    const templateUri = vscode.Uri.file(path.join(context.extensionPath, docName));
    try {
        await vscode.workspace.fs.copy(templateUri, docUri, {overwrite: false});
    } catch {}

    const doc = await vscode.workspace.openTextDocument(docUri);

    if (state.config().autoOpenREPLWindow) {
        const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One, false);
        const firstPos = editor.document.positionAt(0);
        editor.selection = new vscode.Selection(firstPos, firstPos);
        editor.revealRange(new vscode.Range(firstPos, firstPos));
    }

    await _jackIn(genericDefaults[0], async () => {
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.One, false);
        await eval.loadFile({}, state.config().prettyPrintingOptions);
        outputWindow.appendPrompt();
    });
}

export async function startOrConnectRepl() {
    const JACK_IN_OPTION = "Start your project with a REPL server and connect (a.k.a. Jack-in)";
    const JACK_IN_COMMAND = "calva.jackIn";
    const START_REPL_OPTION = "Start a standalone REPL server";
    const START_REPL_COMMAND = "calva.startStandaloneRepl";
    const START_HELLO_REPL_OPTION = "Start a standalone ”Hello World” REPL server";
    const START_HELLO_REPL_COMMAND = "calva.startStandaloneHelloRepl";
    const CONNECT_PROJECT_OPTION = "Connect to a running REPL server in your project";
    const CONNECT_PROJECT_COMMAND = "calva.connect";
    const CONNECT_STANDALONE_OPTION = "Connect to a running REPL server, not in your project";
    const CONNECT_STANDALONE_COMMAND = "calva.connectNonProjectREPL";
    const DISCONNECT_OPTION = "Disconnect from the REPL server";
    const DISCONNECT_COMMAND = "calva.disconnect";
    const OPEN_WINDOW_OPTION = "Open the Output Window";
    const OPEN_WINDOW_COMMAND = "calva.showOutputWindow";
    const PREFERRED_ORDER = [
        JACK_IN_OPTION,
        CONNECT_PROJECT_OPTION,
        START_REPL_OPTION,
        START_HELLO_REPL_OPTION,
        CONNECT_STANDALONE_OPTION,
        OPEN_WINDOW_OPTION,
        DISCONNECT_OPTION
    ]
    let commands = {};
    if (!utilities.getConnectedState() &&
        !utilities.getConnectingState() &&
        !utilities.getLaunchingState()) {

        if (vscode.workspace.workspaceFolders &&
            vscode.workspace.workspaceFolders.length > 0) {
            if (vscode.workspace.workspaceFolders[0].uri.scheme != "vsls") {
                commands[JACK_IN_OPTION] = JACK_IN_COMMAND;
                commands[CONNECT_STANDALONE_OPTION] = CONNECT_STANDALONE_COMMAND;
            } 
            commands[CONNECT_PROJECT_OPTION] = CONNECT_PROJECT_COMMAND;
        } else {
            commands[CONNECT_STANDALONE_OPTION] = CONNECT_STANDALONE_COMMAND;
            commands[START_REPL_OPTION] = START_REPL_COMMAND;
            commands[START_HELLO_REPL_OPTION] = START_HELLO_REPL_COMMAND;
        }
    } else {
        commands[DISCONNECT_OPTION] = DISCONNECT_COMMAND;
        if (namespace.getSession("clj")) {
            commands[OPEN_WINDOW_OPTION] = OPEN_WINDOW_COMMAND;
        }
    }

    const sortedCommands = utilities.sortByPresetOrder(Object.keys(commands), PREFERRED_ORDER);
    vscode.window.showQuickPick(sortedCommands).then(v => {
        if (commands[v]) {
            vscode.commands.executeCommand(commands[v]);
        }
    })
}
