import * as vscode from 'vscode';
import * as util from './utilities';

// TODO - this module has some code common with `state`. We can refactor `state` to use this functions.

export function getProjectWsFolder(): vscode.WorkspaceFolder {
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

export async function findProjectRootUri(projectFileNames, doc, workspaceFolder): Promise<Object> {
    let searchUri = doc?.uri || workspaceFolder?.uri;
    if (searchUri && !(searchUri.scheme === 'untitled')) {
        let prev = null;
        while (searchUri != prev) {
            try {
                for (let projectFile in projectFileNames) {
                    const u = vscode.Uri.joinPath(searchUri, projectFileNames[projectFile]);
                    try {
                        await vscode.workspace.fs.stat(u);
                        return searchUri;
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

// stateless function to get project root uri
export async function getProjectRootUri(): Promise<any> {
    const projectFileNames: string[] = ["project.clj", "shadow-cljs.edn", "deps.edn"];
    const doc = util.getDocument({});
    const workspaceFolder = getProjectWsFolder();
    return findProjectRootUri(projectFileNames, doc, workspaceFolder);
}


