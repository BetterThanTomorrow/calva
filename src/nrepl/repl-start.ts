import * as vscode from "vscode";
import * as path from 'path';
import * as state from "../state";
import eval from '../evaluate';
import * as utilities from "../utilities";
import * as sequence from "./connectSequence";
import * as jackIn from "./jack-in";
import * as outputWindow from '../results-output/results-doc';
import { getConfig } from '../config';
import * as replSession from './repl-session';

export const USER_TEMPLATE_FILE_NAMES = ['user.clj'];
export const HELLO_TEMPLATE_FILE_NAMES = ['hello_repl.clj', 'hello_paredit.clj', 'welcome_to_clojure.clj'];
const TEMPLATES_SUB_DIR = 'bundled';

async function downloadDram(storageUri: vscode.Uri, filePath: string) {
    const DRAM_BASE_URL = 'https://raw.githubusercontent.com/BetterThanTomorrow/dram';
    const calva = vscode.extensions.getExtension("betterthantomorrow.calva");
    const calvaVersion = calva.packageJSON.version;
    const isDebug = process.env["IS_DEBUG"] === "true";
    const branch = isDebug || calvaVersion.match(/-.+$/) ? 'dev' : 'published';
    const dramBaseUrl = `${DRAM_BASE_URL}/${branch}/drams`;
    const downloadUrl = `${dramBaseUrl}/${filePath}`
    const fileName = path.basename(filePath);
    const storeFileUri = vscode.Uri.joinPath(storageUri, fileName);
    return await utilities.downloadFromUrl(downloadUrl, storeFileUri.fsPath).catch(err => {
        console.error(`Error downloading ${filePath}: ${err.message}`);
    });
}

export async function downloadDrams(storageUri: vscode.Uri, filePaths: string[]) {
    await Promise.all(filePaths.map(async filePath => {
        await downloadDram(storageUri, filePath).then(() => {
            console.log(`Downloaded ${filePath}`);
        });
    }));
}

async function openStoredDoc(storageUri: vscode.Uri, tempDirUri: vscode.Uri, docName: string): Promise<[vscode.TextDocument, vscode.TextEditor]> {
    const sourceUri = vscode.Uri.file(path.join(storageUri.fsPath, docName));
    const destUri = vscode.Uri.file(path.join(tempDirUri.fsPath, docName));
    try {
        await vscode.workspace.fs.copy(sourceUri, destUri, { overwrite: false });
    } catch { }
    const doc = await vscode.workspace.openTextDocument(destUri);
    const editor = await vscode.window.showTextDocument(doc, {
        preview: false,
        viewColumn: vscode.ViewColumn.One,
        preserveFocus: true
    });
    return [doc, editor];
}

async function extractBundledFiles(context: vscode.ExtensionContext, storageUri: vscode.Uri, docNames: string[]) {
    await Promise.all(docNames.map(async docName => {
        let docUri: vscode.Uri;
        docUri = vscode.Uri.file(path.join(storageUri.fsPath, docName));
        const templateUri = vscode.Uri.file(path.join(context.extensionPath, TEMPLATES_SUB_DIR, docName));
        try {
            await vscode.workspace.fs.copy(templateUri, docUri, { overwrite: true });
        } catch { }
    }));
}

export async function startStandaloneRepl(context: vscode.ExtensionContext, docNames: string[], areBundled: boolean) {
    let tempDirUri = await state.getOrCreateNonProjectRoot(context);
    await state.initProjectDir(tempDirUri);

    const storageUri = vscode.Uri.joinPath(context.globalStorageUri, 'drams');

    await vscode.workspace.fs.createDirectory(storageUri);
    await vscode.workspace.fs.createDirectory(tempDirUri);
    if (areBundled) {
        await extractBundledFiles(context, storageUri, docNames);
    } else {
        await downloadDrams(storageUri, docNames).catch(err => {
            console.error(`Error downloading drams: ${err.message}`);
            vscode.window.showWarningMessage(`Error downloading files: ${err.message}`)
        });
    }

    const [mainDoc, mainEditor] = await openStoredDoc(storageUri, tempDirUri, docNames[0]);
    docNames.slice(1).forEach(async docName => {
        await openStoredDoc(storageUri, tempDirUri, docName);
    });
    const firstPos = mainEditor.document.positionAt(0);
    mainEditor.selection = new vscode.Selection(firstPos, firstPos);
    mainEditor.revealRange(new vscode.Range(firstPos, firstPos));
    await vscode.window.showTextDocument(mainDoc, { preview: false, viewColumn: vscode.ViewColumn.One, preserveFocus: false });

    await jackIn.jackIn(sequence.genericDefaults[0], async () => {
        await vscode.window.showTextDocument(mainDoc, { preview: false, viewColumn: vscode.ViewColumn.One, preserveFocus: false });
        await eval.loadFile({}, getConfig().prettyPrintingOptions);
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
            commands[START_HELLO_REPL_OPTION] = START_HELLO_REPL_COMMAND;
        } else {
            commands[CONNECT_STANDALONE_OPTION] = CONNECT_STANDALONE_COMMAND;
            commands[START_REPL_OPTION] = START_REPL_COMMAND;
            commands[START_HELLO_REPL_OPTION] = START_HELLO_REPL_COMMAND;
        }
    } else {
        commands[DISCONNECT_OPTION] = DISCONNECT_COMMAND;
        if (replSession.getSession("clj")) {
            commands[OPEN_WINDOW_OPTION] = OPEN_WINDOW_COMMAND;
        }
    }

    const sortedCommands = utilities.sortByPresetOrder(Object.keys(commands), PREFERRED_ORDER);
    vscode.window.showQuickPick(sortedCommands).then(v => {
        if (commands[v]) {
            vscode.commands.executeCommand(commands[v]);
        }
    });
}
