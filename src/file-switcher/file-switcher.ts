import * as vscode from 'vscode';
import * as path from 'path';

function isWindows(openedFilename) {
    return openedFilename.includes('\\');
}

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
    const uriFile = vscode.Uri.file(`${dir}${file}`);
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
                openFile(`${dir}${file}`);
            });
        }
    });
}

function isCodeFile(openedFilename) {
    if (isWindows(openedFilename)) {
        return openedFilename.match(/(.*\\)(test|src|main)(.*\\)(.*)(\.\w+)$/);
    }
    return openedFilename.match(/(.*\/)(test|src|main)(.*\/)(.*)(\.\w+)$/);
}

export async function toggleBetweenImplAndTest() {
    const activeFile = vscode.window.activeTextEditor;
    const openedFilename = activeFile.document.fileName;
    const openedFile = isCodeFile(openedFilename);

    if (!openedFile) {
        return;
    }

    const startDir = openedFile[1];
    const testOrSrc = openedFile[2];
    const postDir = openedFile[3];
    const fileName = openedFile[4];
    const extension = openedFile[5];
    const isMavenStyle = (openedFilename.includes(path.join('src', 'main'))
        || openedFilename.includes(path.join('src', 'test'))) ? true : false;

    let replacedFolderName = (testOrSrc === 'src' || testOrSrc === 'main') ? 'test' : 'src';
    if (isMavenStyle && replacedFolderName === 'src') {
        replacedFolderName = 'main';
    }

    let newFilename = '';

    if (fileName.includes('_test')) {
        const strippedFileName = fileName.replace('_test', '');
        newFilename = `${strippedFileName}${extension}`;
    } else {
        newFilename = `${fileName}_test${extension}`;
    }

    const filePath = path.join(startDir, replacedFolderName, postDir, newFilename);
    const fileToOpen = vscode.workspace.asRelativePath(filePath);

    vscode.workspace.findFiles(fileToOpen, '**/.calva/**').then((files) => {
        if (!files.length) {
            askToCreateANewFile(startDir + replacedFolderName + postDir, newFilename);
        } else {
            const file = files[0].fsPath;
            openFile(file);
        }
    });
}
