import * as vscode from 'vscode';
import * as fs from 'fs';
import * as state from './state';

const filesCache: Map<string, string> = new Map();

function writeToCache(uri: vscode.Uri) {
  try {
    const content: string = fs.readFileSync(uri.fsPath, 'utf8');
    filesCache.set(uri.fsPath, content);
  } catch {
    // if the file is not readable anymore then don't keep old content in cache
    filesCache.delete(uri.fsPath);
  }
}

/**
 * Tries to get content of cached file
 * @param path - absolute or relative to the project
 */
export const content = (path: string | undefined) => {
  const resolvedPath = state.resolvePath(path);
  if (resolvedPath) {
    if (!filesCache.has(resolvedPath.fsPath)) {
      writeToCache(resolvedPath);
      const filesWatcher = vscode.workspace.createFileSystemWatcher(resolvedPath.fsPath);
      filesWatcher.onDidChange(writeToCache);
      filesWatcher.onDidCreate(writeToCache);
      filesWatcher.onDidDelete((uri) => filesCache.delete(uri.fsPath));
    }
    return filesCache.get(resolvedPath.fsPath);
  }
};
