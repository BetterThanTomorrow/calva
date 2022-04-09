import * as vscode from 'vscode';
import * as path from 'path';
import * as util from './util';
import * as projectRoot from '../project-root';
import { getActiveTextEditor } from '../utilities';

function openFile(file) {
  return vscode.workspace
    .openTextDocument(vscode.Uri.file(file))
    .then((doc) => vscode.window.showTextDocument(doc, { preserveFocus: true }));
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
  return showConfirmationDialog(`Create ${filePath}?`, 'Create').then((answer) => {
    if (answer === 'Create') {
      void createNewFile(dir, file).then(() => {
        void openFile(filePath);
      });
    }
  });
}

export async function toggleBetweenImplAndTest() {
  const activeFile = getActiveTextEditor();
  const openedFilename = activeFile.document.fileName;
  const projectRootPath = await projectRoot.findClosestProjectRootPath();
  const pathAfterRoot = openedFilename.replace(projectRootPath, '');
  const fullFileName = path.basename(openedFilename);
  const extension = path.extname(fullFileName);
  const fileName = fullFileName.substring(0, fullFileName.length - extension.length);

  const { success, message } = util.isFileValid(fullFileName, pathAfterRoot);
  if (!success) {
    void vscode.window.showErrorMessage(message);
    return;
  }

  const sourcePath = util.getNewSourcePath(pathAfterRoot);
  const newFilename = util.getNewFilename(fileName, extension);

  const filePath = path.join(projectRootPath, sourcePath, newFilename);
  const fileToOpen = vscode.workspace.asRelativePath(filePath, false);

  void vscode.workspace.findFiles(fileToOpen, projectRoot.excludePattern()).then((files) => {
    if (!files.length) {
      void askToCreateANewFile(path.join(projectRootPath, sourcePath), newFilename);
    } else {
      const file = files[0].fsPath;
      void openFile(file);
    }
  });
}
