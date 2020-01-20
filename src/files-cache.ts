import * as vscode from 'vscode';
import * as fs from 'fs';
import * as state from "./state";

const filesGlob: vscode.GlobPattern = "**/*.edn";
const filesCache: Map<string, string> = new Map();
const filesWatcher = vscode.workspace.createFileSystemWatcher(filesGlob);

function writeToCache(uri: vscode.Uri) {
    try {
        filesCache.set(uri.fsPath, fs.readFileSync(uri.fsPath, "utf8"))
    } catch {
        // if the file is not readable anymore then don't keep old content in cache
        filesCache.delete(uri.fsPath)
    }
}

vscode.workspace.findFiles(filesGlob).then((uris) => uris.forEach(writeToCache));
filesWatcher.onDidChange(writeToCache);
filesWatcher.onDidCreate(writeToCache);
filesWatcher.onDidDelete((uri) => filesCache.delete(uri.fsPath));

/**
 * Tries to get content of cached file
 * @param path - absolute or relative to the project
 */
export const content = (path?: string) => filesCache.get(state.resolvePath(path));