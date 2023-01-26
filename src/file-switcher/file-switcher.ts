import * as vscode from 'vscode';
import * as path from 'path';
import * as util from './util';
import * as projectRoot from '../project-root';
import { getActiveTextEditor } from '../utilities';

function openFile(file: string | vscode.Uri) {
  const fileUri: vscode.Uri = file instanceof vscode.Uri ? file : vscode.Uri.file(file);
  return vscode.workspace
    .openTextDocument(fileUri)
    .then((doc) => vscode.window.showTextDocument(doc, { preserveFocus: false }));
}

function showConfirmationDialog(text, button) {
  return vscode.window.showWarningMessage(text, { modal: true }, button);
}

async function createNewFile(dir: vscode.Uri, fileUri: vscode.Uri) {
  await vscode.workspace.fs.createDirectory(dir);
  const ws = new vscode.WorkspaceEdit();
  ws.createFile(fileUri);
  await vscode.workspace.applyEdit(ws);
}

function askToCreateANewFile(dir: vscode.Uri, filename: string) {
  const fileUri = vscode.Uri.joinPath(dir, filename);
  return showConfirmationDialog(`Create ${fileUri.fsPath}?`, 'Create').then((answer) => {
    if (answer === 'Create') {
      void createNewFile(dir, fileUri).then(() => {
        void openFile(fileUri);
      });
    }
  });
}

export async function toggleBetweenImplAndTest() {
  const activeFile = getActiveTextEditor();
  const openedFilename = activeFile.document.fileName;
  const projectRootUri = projectRoot.findClosestParent(
    vscode.window.activeTextEditor?.document.uri,
    await projectRoot.findProjectRoots()
  );
  const projectRootPath = projectRootUri.fsPath;
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
  let fileToOpen = vscode.workspace.asRelativePath(filePath, false);
  if (fileToOpen[0] === '/') {
    // When connected over live share, the above will result in an absolute path,
    // which causes workspace.findFiles to not find the file. So we strip the
    // leading slash to prevent such scenarios.
    fileToOpen = fileToOpen.substring(1);
  }

  void vscode.workspace.findFiles(fileToOpen, projectRoot.excludePattern()).then((files) => {
    if (!files.length) {
      void askToCreateANewFile(vscode.Uri.joinPath(projectRootUri, sourcePath), newFilename);
    } else {
      const file = files[0];
      void openFile(file);
    }
  });
}
