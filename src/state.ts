import * as vscode from 'vscode';
import * as Immutable from 'immutable';
import * as ImmutableCursor from 'immutable-cursor';
import Analytics from './analytics';
import { ReplConnectSequence } from './nrepl/connectSequence';
import { JackInDependency } from './nrepl/project-types';
import * as util from './utilities';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { customREPLCommandSnippet } from './evaluate';
import { PrettyPrintingOptions } from './printer';

let extensionContext: vscode.ExtensionContext;
export function setExtensionContext(context: vscode.ExtensionContext) {
    extensionContext = context;
    if (context.workspaceState.get('selectedCljTypeName') == undefined) {
        context.workspaceState.update('selectedCljTypeName', "unknown");
    }
}

// include the 'file' and 'untitled' to the
// document selector. All other schemes are
// not known and therefore not supported.
const documentSelector = [
    { scheme: 'file', language: 'clojure' },
    { scheme: 'jar', language: 'clojure' },
    { scheme: 'untitled', language: 'clojure' }
];

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
    analytics: null,
    lspClient: null
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

/**
 * Trims EDN alias and profile names from any surrounding whitespace or `:` characters.
 * This in order to free the user from having to figure out how the name should be entered.
 * @param  {string} name
 * @return {string} The trimmed name
 */
function _trimAliasName(name: string): string {
    return name.replace(/^[\s,:]*/, "").replace(/[\s,:]*$/, "")
}

// TODO find a way to validate the configs
function config() {
    const configOptions = vscode.workspace.getConfiguration('calva');
    return {
        format: configOptions.get("formatOnSave"),
        evaluate: configOptions.get("evalOnSave"),
        test: configOptions.get("testOnSave"),
        showDocstringInParameterHelp: configOptions.get("showDocstringInParameterHelp") as boolean,
        jackInEnv: configOptions.get("jackInEnv"),
        jackInDependencyVersions: configOptions.get("jackInDependencyVersions") as { JackInDependency: string },
        openBrowserWhenFigwheelStarted: configOptions.get("openBrowserWhenFigwheelStarted") as boolean,
        customCljsRepl: configOptions.get("customCljsRepl", null),
        replConnectSequences: configOptions.get("replConnectSequences") as ReplConnectSequence[],
        myLeinProfiles: configOptions.get("myLeinProfiles", []).map(_trimAliasName) as string[],
        myCljAliases: configOptions.get("myCljAliases", []).map(_trimAliasName) as string[],
        asyncOutputDestination: configOptions.get("sendAsyncOutputTo") as string,
        customREPLCommandSnippets: configOptions.get("customREPLCommandSnippets", []),
        customREPLCommandSnippetsGlobal: configOptions.inspect("customREPLCommandSnippets").globalValue as customREPLCommandSnippet[],
        customREPLCommandSnippetsWorkspace: configOptions.inspect("customREPLCommandSnippets").workspaceValue as customREPLCommandSnippet[],
        customREPLCommandSnippetsWorkspaceFolder: configOptions.inspect("customREPLCommandSnippets").workspaceFolderValue as customREPLCommandSnippet[],
        prettyPrintingOptions: configOptions.get("prettyPrintingOptions") as PrettyPrintingOptions,
        enableJSCompletions: configOptions.get("enableJSCompletions") as boolean,
        autoOpenREPLWindow: configOptions.get("autoOpenREPLWindow") as boolean,
        autoOpenJackInTerminal: configOptions.get("autoOpenJackInTerminal") as boolean,
        referencesCodeLensEnabled: configOptions.get('referencesCodeLens.enabled') as boolean,
        hideReplUi: configOptions.get('hideReplUi') as boolean,
    };
}

const PROJECT_DIR_KEY = "connect.projectDir";
const PROJECT_DIR_URI_KEY = "connect.projectDirNew";

export function getProjectRootLocal(useCache = true): string {
    if (useCache) {
        return deref().get(PROJECT_DIR_KEY);
    }
}

export function getProjectRootUri(useCache = true): vscode.Uri {
    if (useCache) {
        return deref().get(PROJECT_DIR_URI_KEY);
    }
}

export async function getOrCreateNonProjectRoot(context: vscode.ExtensionContext): Promise<vscode.Uri> {
    const NON_PROJECT_DIR_KEY = "calva.connect.nonProjectDir";
    let root = getProjectRootUri();
    if (!root) {
        try {
            root = await context.workspaceState.get(NON_PROJECT_DIR_KEY) as vscode.Uri;
        } catch {
            root = await context.globalState.get(NON_PROJECT_DIR_KEY) as vscode.Uri;
        }
    }
    if (!root) {
        const subDir = Math.random().toString(36).substring(7);
        root = vscode.Uri.file(path.join(os.tmpdir(), subDir));
    }
    try {
        context.workspaceState.update(NON_PROJECT_DIR_KEY, root);
    } catch {
        context.globalState.update(NON_PROJECT_DIR_KEY, root);
    }
    return root;
}

function getProjectWsFolder(): vscode.WorkspaceFolder {
    const doc = util.getDocument({});
    if (doc) {
        const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
        if (folder) {
            return folder;
        }
    }
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        return vscode.workspace.workspaceFolders[0];
    }
    return undefined;
}

/**
 * Figures out, and stores, the current clojure project root
 * Also stores the WorkSpace folder for the project.
 *
 * 1. If there is no file open in single-rooted workspace use
 *    the workspace folder as a starting point. In multi-rooted
 *    workspaces stop and complain.
 * 2. If there is a file open, use it to determine the project root
 *    by looking for project files from the file's directory and up to
 *    the window root (for plain folder windows) or the file's
 *    workspace folder root (for workspaces) to find the project root.
 */
export async function initProjectDir(uri?: vscode.Uri): Promise<void> {
    if (uri) {
        cursor.set(PROJECT_DIR_KEY, path.resolve(uri.fsPath));
        cursor.set(PROJECT_DIR_URI_KEY, uri);    
    } else {
        const projectFileNames: string[] = ["project.clj", "shadow-cljs.edn", "deps.edn"];
        const doc = util.getDocument({});
        let workspaceFolder = getProjectWsFolder();
        await findLocalProjectRoot(projectFileNames, doc, workspaceFolder);
        await findProjectRootUri(projectFileNames, doc, workspaceFolder);
    }
}

async function findLocalProjectRoot(projectFileNames, doc, workspaceFolder): Promise<void> {
    if (workspaceFolder) {
        let rootPath: string = path.resolve(workspaceFolder.uri.fsPath);
        cursor.set(PROJECT_DIR_KEY, rootPath);
        cursor.set(PROJECT_DIR_URI_KEY, workspaceFolder.uri);

        let d = null;
        let prev = null;
        if (doc && path.dirname(doc.uri.fsPath) !== '.') {
            d = path.dirname(doc.uri.fsPath);
        } else {
            d = workspaceFolder.uri.fsPath;
        }
        while (d !== prev) {
            for (let projectFile in projectFileNames) {
                const p = path.resolve(d, projectFileNames[projectFile]);
                if (fs.existsSync(p)) {
                    rootPath = d;
                    break;
                }
            }
            if (d === rootPath) {
                break;
            }
            prev = d;
            d = path.resolve(d, "..");
        }

        // at least be sure the the root folder contains a
        // supported project.
        for (let projectFile in projectFileNames) {
            const p = path.resolve(rootPath, projectFileNames[projectFile]);
            if (fs.existsSync(p)) {
                cursor.set(PROJECT_DIR_KEY, rootPath);
                cursor.set(PROJECT_DIR_URI_KEY, vscode.Uri.file(rootPath));
                return;
            }
        }
    }
    return;
}

async function findProjectRootUri(projectFileNames, doc, workspaceFolder): Promise<void> {
    let searchUri = doc?.uri || workspaceFolder?.uri;
    if (searchUri && !(searchUri.scheme === 'untitled')) {
        let prev = null;
        while (searchUri != prev) {
            try {
                for (let projectFile in projectFileNames) {
                    const u = vscode.Uri.joinPath(searchUri, projectFileNames[projectFile]);
                    try {
                        await vscode.workspace.fs.stat(u);
                        cursor.set(PROJECT_DIR_URI_KEY, searchUri);
                        return;
                    }
                    catch { }
                }
            }
            catch (e) { 
                console.error(`Problems in search for project root directory: ${e}`);
            }
            prev = searchUri;
            searchUri = vscode.Uri.joinPath(searchUri, "..");
        }
    }
}

/**
 *
 * Tries to resolve absolute path in relation to project root
 * @param filePath - absolute or relative to the project
 */
export function resolvePath(filePath?: string) {
    const root = getProjectWsFolder();
    if (filePath && path.isAbsolute(filePath)) {
        return filePath;
    }
    return filePath && root && path.resolve(root.uri.fsPath, filePath);
}

export {
    cursor,
    documentSelector,
    deref,
    reset,
    config,
    extensionContext,
    outputChannel,
    connectionLogChannel,
    analytics
};
