import * as vscode from 'vscode';
import * as path from 'path';

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

function isFileValid(openedFilename) {
    return openedFilename.includes('src')
    || openedFilename.includes('test')
    || openedFilename.includes('main');
}

function getNewFilename(fileName, extension) {
    if (fileName.includes('_test')) {
        const strippedFileName = fileName.replace('_test', '');
        return `${strippedFileName}${extension}`;
    }
    return `${fileName}_test${extension}`;
}

function getNewSourcePath(sourcePath) {
    let replacedSourcePath = '';
    const srcMainPath = path.join('src', 'main');
    const srcTestPath = path.join('src', 'test');

    if (sourcePath.includes(srcMainPath)) {
        replacedSourcePath = sourcePath.replace(srcMainPath, srcTestPath);
    } else if (sourcePath.includes(srcTestPath)) {
        replacedSourcePath = sourcePath.replace(srcTestPath, srcMainPath);
    } else if (sourcePath.includes('src')) {
        replacedSourcePath = sourcePath.replace('src', 'test');
    } else if (sourcePath.includes('test')) {
        replacedSourcePath = sourcePath.replace('test', 'src');
    }
    return path.dirname(replacedSourcePath);
}

export async function toggleBetweenImplAndTest() {
    const activeFile = vscode.window.activeTextEditor;
    const openedFilename = activeFile.document.fileName;
    const valid = isFileValid(openedFilename);

    if (!valid) {
        return;
    }

    const fullFileName = openedFilename.split(path.sep).slice(-1)[0];
    // Assumption: File names can't contain dots.
    const fileName = fullFileName.split('.')[0];
    const extension = '.' + fullFileName.split('.')[1];

    const sourcePath = getNewSourcePath(openedFilename);
    const newFilename = getNewFilename(fileName, extension);

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
