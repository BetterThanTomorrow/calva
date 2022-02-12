import * as vscode from 'vscode';
import Analytics from './analytics';
import * as util from './utilities';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { getStateValue, setStateValue } from '../out/cljs-lib/cljs-lib';

let extensionContext: vscode.ExtensionContext;
export function setExtensionContext(context: vscode.ExtensionContext) {
    extensionContext = context;
    if (context.workspaceState.get('selectedCljTypeName') == undefined) {
        context.workspaceState.update('selectedCljTypeName', 'unknown');
    }
}

// Super-quick fix for: https://github.com/BetterThanTomorrow/calva/issues/144
// TODO: Revisit the whole state management business.
function _outputChannel(name: string): vscode.OutputChannel {
    const channel = getStateValue(name);
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
    const analytics = getStateValue('analytics');
    if (analytics.toJS !== undefined) {
        return analytics.toJS();
    } else {
        return analytics;
    }
}

const PROJECT_DIR_KEY = 'connect.projectDir';
const PROJECT_DIR_URI_KEY = 'connect.projectDirNew';
const PROJECT_CONFIG_MAP = 'config';

export function getProjectRootLocal(useCache = true): string {
    if (useCache) {
        return getStateValue(PROJECT_DIR_KEY);
    }
}

export function getProjectConfig(useCache = true) {
    if (useCache) {
        return getStateValue(PROJECT_CONFIG_MAP);
    }
}

export function setProjectConfig(config) {
    return setStateValue(PROJECT_CONFIG_MAP, config);
}

export function getProjectRootUri(useCache = true): vscode.Uri {
    if (useCache) {
        return getStateValue(PROJECT_DIR_URI_KEY);
    }
}

const NON_PROJECT_DIR_KEY = 'calva.connect.nonProjectDir';

export async function getNonProjectRootDir(
    context: vscode.ExtensionContext
): Promise<vscode.Uri> {
    let root: vscode.Uri;
    if (!process.env['NEW_DRAMS']) {
        root = (await context.globalState.get(
            NON_PROJECT_DIR_KEY
        )) as vscode.Uri;
    }
    if (root) {
        const createNewOption = 'Create new temp directory, download new files';
        const useExistingOption =
            'Use existing temp directory, reuse any existing files';
        root = await vscode.window
            .showQuickPick([useExistingOption, createNewOption], {
                placeHolder: 'Reuse the existing REPL temp dir and its files?',
            })
            .then((option) => {
                return option === useExistingOption ? root : undefined;
            });
    }
    if (typeof root === 'object') {
        root = vscode.Uri.file(root.path);
    }
    return root;
}

export async function setNonProjectRootDir(
    context: vscode.ExtensionContext,
    root: vscode.Uri
) {
    await context.globalState.update(NON_PROJECT_DIR_KEY, root);
}

export async function getOrCreateNonProjectRoot(
    context: vscode.ExtensionContext,
    preferProjectDir = false
): Promise<vscode.Uri> {
    let root: vscode.Uri;
    if (preferProjectDir) {
        root = getProjectRootUri();
    }
    if (!root) {
        root = await getNonProjectRootDir(context);
    }
    if (!root) {
        const subDir = util.randomSlug();
        root = vscode.Uri.file(
            path.join(os.tmpdir(), 'betterthantomorrow.calva', subDir)
        );
        await setNonProjectRootDir(context, root);
    }
    setStateValue(
        PROJECT_DIR_KEY,
        path.resolve(root.fsPath ? root.fsPath : root.path)
    );
    setStateValue(PROJECT_DIR_URI_KEY, root);
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
    if (
        vscode.workspace.workspaceFolders &&
        vscode.workspace.workspaceFolders.length > 0
    ) {
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
        setStateValue(PROJECT_DIR_KEY, path.resolve(uri.fsPath));
        setStateValue(PROJECT_DIR_URI_KEY, uri);
    } else {
        const projectFileNames: string[] = [
            'project.clj',
            'shadow-cljs.edn',
            'deps.edn',
        ];
        const doc = util.getDocument({});
        const workspaceFolder = getProjectWsFolder();
        await findLocalProjectRoot(projectFileNames, doc, workspaceFolder);
        await findProjectRootUri(projectFileNames, doc, workspaceFolder);
    }
}

async function findLocalProjectRoot(
    projectFileNames,
    doc,
    workspaceFolder
): Promise<void> {
    if (workspaceFolder) {
        let rootPath: string = path.resolve(workspaceFolder.uri.fsPath);
        setStateValue(PROJECT_DIR_KEY, rootPath);
        setStateValue(PROJECT_DIR_URI_KEY, workspaceFolder.uri);

        let d = null;
        let prev = null;
        if (doc && path.dirname(doc.uri.fsPath) !== '.') {
            d = path.dirname(doc.uri.fsPath);
        } else {
            d = workspaceFolder.uri.fsPath;
        }
        while (d !== prev) {
            for (const projectFile in projectFileNames) {
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
            d = path.resolve(d, '..');
        }

        // at least be sure the the root folder contains a
        // supported project.
        for (const projectFile in projectFileNames) {
            const p = path.resolve(rootPath, projectFileNames[projectFile]);
            if (fs.existsSync(p)) {
                setStateValue(PROJECT_DIR_KEY, rootPath);
                setStateValue(PROJECT_DIR_URI_KEY, vscode.Uri.file(rootPath));
                return;
            }
        }
    }
    return;
}

async function findProjectRootUri(
    projectFileNames,
    doc,
    workspaceFolder
): Promise<void> {
    let searchUri = doc?.uri || workspaceFolder?.uri;
    if (searchUri && !(searchUri.scheme === 'untitled')) {
        let prev = null;
        while (searchUri != prev) {
            try {
                for (const projectFile in projectFileNames) {
                    const u = vscode.Uri.joinPath(
                        searchUri,
                        projectFileNames[projectFile]
                    );
                    try {
                        await vscode.workspace.fs.stat(u);
                        setStateValue(PROJECT_DIR_URI_KEY, searchUri);
                        return;
                    } catch {
                        // continue regardless of error
                    }
                }
            } catch (e) {
                console.error(
                    `Problems in search for project root directory: ${e}`
                );
            }
            prev = searchUri;
            searchUri = vscode.Uri.joinPath(searchUri, '..');
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

export { extensionContext, outputChannel, connectionLogChannel, analytics };
