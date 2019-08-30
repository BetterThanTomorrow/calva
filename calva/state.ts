import * as vscode from 'vscode';
import * as Immutable from 'immutable';
import * as ImmutableCursor from 'immutable-cursor';
import Analytics from './analytics';
import { ReplConnectSequence } from './nrepl/connectSequence';
import * as util from './utilities';
import * as path from 'path';
import * as fs from 'fs';

let extensionContext: vscode.ExtensionContext;
export function setExtensionContext(context: vscode.ExtensionContext) {
    extensionContext = context;
    if (context.workspaceState.get('selectedCljTypeName') == undefined) {
        context.workspaceState.update('selectedCljTypeName', "unknown");
    }
}

const mode = {
    language: 'clojure',
    //scheme: 'file'
};
var data;
const initialData = {
    hostname: null,
    port: null,
    clj: null,
    cljs: null,
    cljsBuild: null,
    terminal: null,
    connected: false,
    connecting: false,
    outputChannel: vscode.window.createOutputChannel("Calva says"),
    connectionLogChannel: vscode.window.createOutputChannel("Calva Connection Log"),
    diagnosticCollection: vscode.languages.createDiagnosticCollection('calva: Evaluation errors'),
    analytics: null
};

reset();

const cursor = ImmutableCursor.from(data, [], (nextState) => {
    data = Immutable.fromJS(nextState);
});

function deref() {
    return data;
}

// Super-quick fix for: https://github.com/BetterThanTomorrow/calva/issues/144
// TODO: Revisit the whole state management business.
function _outputChannel(name: string): vscode.OutputChannel {
    const channel = deref().get(name);
    if (channel.toJS !== undefined) {
        return channel.toJS();
    } else {
        return channel;
    }
}

function outputChannel(): vscode.OutputChannel {
    return _outputChannel('outputChannel');
}

function connectionLogChannel(): vscode.OutputChannel {
    return _outputChannel('connectionLogChannel');
}

function analytics(): Analytics {
    const analytics = deref().get('analytics');
    if (analytics.toJS !== undefined) {
        return analytics.toJS();
    } else {
        return analytics;
    }
}


function reset() {
    data = Immutable.fromJS(initialData);
}

function config() {
    let configOptions = vscode.workspace.getConfiguration('calva');
    return {
        format: configOptions.get("formatOnSave"),
        evaluate: configOptions.get("evalOnSave"),
        lint: configOptions.get("lintOnSave"),
        test: configOptions.get("testOnSave"),
        jokerPath: configOptions.get("jokerPath"),
        useWSL: configOptions.get("useWSL"),
        syncReplNamespaceToCurrentFile: configOptions.get("syncReplNamespaceToCurrentFile"),
        jackInEnv: configOptions.get("jackInEnv"),
        openBrowserWhenFigwheelStarted: configOptions.get("openBrowserWhenFigwheelStarted") as boolean,
        customCljsRepl: configOptions.get("customCljsRepl", null),
        replConnectSequences: configOptions.get("replConnectSequences") as ReplConnectSequence[]
    };
}

const PROJECT_DIR_KEY = "connect.projectDir";
const PROJECT_WS_FOLDER_KEY = "connect.projecWsFolder";

export function getProjectRoot(useCache = true): string {
    if (useCache) {
        return deref().get(PROJECT_DIR_KEY);
    }
}

export function getProjectWsFolder(): vscode.WorkspaceFolder {
    return deref().get(PROJECT_WS_FOLDER_KEY);
}

/**
 * Figures out, and stores, the current clojure project root
 * Also stores the WorkSpace folder for the project to be used
 * when executing the Task and get proper vscode reporting.
 * 
 * 1. If there is no file open. Stop and complain.
 * 2. If there is a file open, use it to determine the project root
 *    by looking for project files from the file's directory and up to
 *    the window root (for plain folder windows) or the file's
 *    workspace folder root (for workspaces) to find the project root.
 *
 * If there is no project file found, then store either of these
 * 1. the window root for plain folders
 * 2. first workspace root for workspaces.
 * (This situation will be detected later by the connect process.)
 */
export async function initProjectDir(): Promise<void> {
    const projectFileNames: string[] = ["project.clj", "shadow-cljs.edn", "deps.edn"],
        doc = util.getDocument({}),
        workspaceFolder = doc ? vscode.workspace.getWorkspaceFolder(doc.uri) : null;
    if (!workspaceFolder) {
        vscode.window.showErrorMessage("There is no document opened in the workspace. Aborting. Please open a file in your Clojure project and try again.");
        analytics().logEvent("REPL", "JackinOrConnectInterrupted", "NoCurrentDocument").send();
        throw "There is no document opened in the workspace. Aborting.";
    } else {
        cursor.set(PROJECT_WS_FOLDER_KEY, workspaceFolder);
        let rootPath: string = path.resolve(workspaceFolder.uri.fsPath);
        let d = path.dirname(doc.uri.fsPath);
        let prev = null;
        while (d != prev) {
            for (let projectFile in projectFileNames) {
                const p = path.resolve(d, projectFileNames[projectFile]);
                if (fs.existsSync(p)) {
                    rootPath = d;
                    break;
                }
            }
            if (d == rootPath) {
                break;
            }
            prev = d;
            d = path.resolve(d, "..");
        }
        cursor.set(PROJECT_DIR_KEY, rootPath);
    }
}

export {
    cursor,
    mode,
    deref,
    reset,
    config,
    extensionContext,
    outputChannel,
    connectionLogChannel,
    analytics
};
