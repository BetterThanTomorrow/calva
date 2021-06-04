import * as vscode from 'vscode';
import * as path from 'path';
import * as util from './util';

function openFile(file) {
    return vscode.workspace
        .openTextDocument(vscode.Uri.file(file))
        .then(doc => vscode.window.showTextDocument(doc, { preserveFocus: true }));
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
    function srcOrTest() {
        if (file.includes('_test'))
            return 'test';
        return 'src';
    }
    return showConfirmationDialog(
        `Create the ${srcOrTest()} file at ${dir}?`,
        'Create',
    ).then((answer) => {
        if (answer === 'Create') {
            createNewFile(dir, file).then(() => {
                openFile(path.join(dir, file));
            });
        }
    });
}

export async function toggleBetweenImplAndTest() {
    const activeFile = vscode.window.activeTextEditor;
    const openedFilename = activeFile.document.fileName;
    const valid = util.isFileValid(openedFilename);

    if (!valid) {
        return;
    }

    const fullFileName = openedFilename.split(path.sep).slice(-1)[0];
    const extension = '.' + fullFileName.split('.').pop();
    const fileName = fullFileName.replace(extension, '');

    const sourcePath = util.getNewSourcePath(openedFilename);
    const newFilename = util.getNewFilename(fileName, extension);

    const filePath = path.join(sourcePath, newFilename);
    const fileToOpen = vscode.workspace.asRelativePath(filePath);

    vscode.workspace.findFiles(fileToOpen, '**/.calva/**').then((files) => {
        if (!files.length) {
            askToCreateANewFile(sourcePath, newFilename);
        } else {
            const file = files[0].fsPath;
            openFile(file);
        }
    });
}
