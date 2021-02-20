
import * as vscode from "vscode";
import * as path from 'path';
import * as state from "../state"
import eval from '../evaluate';
import * as utilities from "../utilities";
import * as namespace from "../namespace";
import * as sequence from "./connectSequence";
import * as jackIn from "./jack-in";
import * as outputWindow from '../results-output/results-doc';

export const USER_TEMPLATE_FILE_NAMES = ['user.clj'];
export const HELLO_TEMPLATE_FILE_NAMES = ['hello_repl.clj', 'hello_paredit.clj', 'hello_clojure.clj'];
const TEMPLATES_SUB_DIR = 'bundled';

async function openBundledDoc(context: vscode.ExtensionContext, tempDirUri: vscode.Uri, docName: string): Promise<[vscode.TextDocument, vscode.TextEditor]> {
    let docUri: vscode.Uri;
    try {
        docUri = vscode.Uri.joinPath(tempDirUri, docName);
    } catch {
        docUri = vscode.Uri.file(path.join(tempDirUri.fsPath, docName));
    }
    const templateUri = vscode.Uri.file(path.join(context.extensionPath, TEMPLATES_SUB_DIR, docName));
    try {
        await vscode.workspace.fs.copy(templateUri, docUri, {overwrite: false});
    } catch {}
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc, {
        preview: false,
        viewColumn: vscode.ViewColumn.One,
        preserveFocus: true
    });
    return [doc, editor];
}

export async function startStandaloneRepl(context: vscode.ExtensionContext, docNames: string[]) {
    let tempDirUri = await state.getOrCreateNonProjectRoot(context);
    await state.initProjectDir(tempDirUri);

    await vscode.workspace.fs.createDirectory(tempDirUri);

    const [mainDoc, mainEditor] = await openBundledDoc(context, tempDirUri, docNames[0]);
    docNames.splice(1).forEach(async docName => {
        await openBundledDoc(context, tempDirUri, docName);            
    });
    const firstPos = mainEditor.document.positionAt(0);
    mainEditor.selection = new vscode.Selection(firstPos, firstPos);
    mainEditor.revealRange(new vscode.Range(firstPos, firstPos));
    await vscode.window.showTextDocument(mainDoc, { preview: false, viewColumn: vscode.ViewColumn.One, preserveFocus: false });
    
    await jackIn.jackIn(sequence.genericDefaults[0], async () => {
        await vscode.window.showTextDocument(mainDoc, { preview: false, viewColumn: vscode.ViewColumn.One, preserveFocus: false });
        await eval.loadFile({}, state.config().prettyPrintingOptions);
        outputWindow.appendPrompt();
    });
}

export async function startOrConnectRepl() {
    const JACK_IN_OPTION = "Start your project with a REPL server and connect (a.k.a. Jack-in)";
    const JACK_IN_COMMAND = "calva.jackIn";
    const START_REPL_OPTION = "Start a standalone REPL server";
    const START_REPL_COMMAND = "calva.startStandaloneRepl";
    const START_HELLO_REPL_OPTION = "Fire up the ”Getting Started” REPL server";
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
