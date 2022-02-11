import * as vscode from 'vscode';
import * as path from 'path';
import * as util from './util';
import * as projectRoot from '../project-root';

function openFile(file) {
    return vscode.workspace
        .openTextDocument(vscode.Uri.file(file))
        .then((doc) =>
            vscode.window.showTextDocument(doc, { preserveFocus: true })
        );
}

function showConfirmationDialog(text, button) {
    return vscode.window.showWarningMessage(text, { modal: true }, button);
}

async function createNewFile(dir, file) {
    const uriDir = vscode.Uri.file(dir);
    const uriFile = vscode.Uri.file(path.join(dir, file));
    const ws = new vscode.WorkspaceEdit();

    await vscode.workspace.fs.createDirectory(uriDir);
    ws.createFile(uriFile);
    await vscode.workspace.applyEdit(ws);
}

function askToCreateANewFile(dir, file) {
    const filePath = path.join(dir, file);
    return showConfirmationDialog(`Create ${filePath}?`, 'Create').then(
        (answer) => {
            if (answer === 'Create') {
                createNewFile(dir, file).then(() => {
                    openFile(filePath);
                });
            }
        }
    );
}

export async function toggleBetweenImplAndTest() {
    const activeFile = vscode.window.activeTextEditor;
    const openedFilename = activeFile.document.fileName;

    const projectRootUri = await projectRoot.getProjectRootUri();
    const projectRootPath = projectRootUri.fsPath;
    const pathAfterRoot = openedFilename.replace(projectRootPath, '');
    const fullFileName = pathAfterRoot.split(path.sep).slice(-1)[0];
    const extension = '.' + fullFileName.split('.').pop();
    const fileName = fullFileName.replace(extension, '');

    const { success, message } = util.isFileValid(fullFileName, pathAfterRoot);
    if (!success) {
        vscode.window.showErrorMessage(message);
        return;
    }

    const sourcePath = util.getNewSourcePath(pathAfterRoot);
    const newFilename = util.getNewFilename(fileName, extension);

    const filePath = path.join(projectRootPath, sourcePath, newFilename);
    const fileToOpen = vscode.workspace.asRelativePath(filePath);

    vscode.workspace.findFiles(fileToOpen, '**/.calva/**').then((files) => {
        if (!files.length) {
            askToCreateANewFile(
                path.join(projectRootPath, sourcePath),
                newFilename
            );
        } else {
            const file = files[0].fsPath;
            openFile(file);
        }
    });
}
