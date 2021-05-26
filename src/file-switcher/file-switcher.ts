import * as vscode from 'vscode';

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
        if(file.includes('_test'))
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
        return openedFilename.match(/(.*\\)(test|src)(.*\\)(.*)(\.\w+)$/);
    }
    return openedFilename.match(/(.*\/)(test|src)(.*\/)(.*)(\.\w+)$/);
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
    const replacedSrcOrTest = testOrSrc === 'src' ? 'test' : 'src';

    let newFilename = '';

    if (fileName.includes('_test')) {
        const strippedFileName = fileName.replace('_test', '');
        newFilename = `${strippedFileName}.clj`;
    } else {
        newFilename = `${fileName}_test.clj`;
    }
    const fileToOpen = vscode.workspace.asRelativePath(
        startDir + replacedSrcOrTest + postDir + newFilename,
    );

    vscode.workspace.findFiles(fileToOpen, '**/.calva/**').then((files) => {
        if (!files.length) {
            askToCreateANewFile(startDir + replacedSrcOrTest + postDir, newFilename);
        } else {
            const file = files[0].fsPath;
            openFile(file);
        }
    });
}
