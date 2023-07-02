import * as vscode from 'vscode';
import * as fiddleFilesUtil from './util/fiddle-files';
import * as state from './state';
import * as config from './config';

export function updateFiddleFileOpenedContext(editor: vscode.TextEditor) {
  if (!editor || !editor.document || editor.document.languageId !== 'clojure') {
    return;
  }
  void vscode.commands.executeCommand(
    'setContext',
    'calva:activeEditorIsFiddle',
    fiddleFilesUtil.isFiddleFile(
      editor.document.fileName,
      state.getProjectRootUri().fsPath,
      config.getConfig().fiddleFilePaths
    )
  );
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(updateFiddleFileOpenedContext),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('calva.fiddleFilePaths')) {
        updateFiddleFileOpenedContext(vscode.window.activeTextEditor);
      }
    })
  );
  updateFiddleFileOpenedContext(vscode.window.activeTextEditor);
}

function openFile(file: string | vscode.Uri) {
  const fileUri: vscode.Uri = file instanceof vscode.Uri ? file : vscode.Uri.file(file);
  return vscode.workspace
    .openTextDocument(fileUri)
    .then((doc) => vscode.window.showTextDocument(doc, { preserveFocus: false }));
}

function showConfirmationDialog(prompt: string, file: string, button: string) {
  return vscode.window.showInformationMessage(prompt, { modal: true, detail: file }, button);
}

async function createNewFile(filePath: string) {
  const fileUri = vscode.Uri.file(filePath);
  const dir = vscode.Uri.file(filePath.substring(0, filePath.lastIndexOf('/')));
  await vscode.workspace.fs.createDirectory(dir);
  const ws = new vscode.WorkspaceEdit();
  ws.createFile(fileUri);
  await vscode.workspace.applyEdit(ws);
}

async function askToCreateANewFile(filePath: string) {
  const answer = await showConfirmationDialog(
    `The file does not exist. Do you want to create it?`,
    vscode.workspace.asRelativePath(filePath),
    'Create'
  );
  if (answer === 'Create') {
    void createNewFile(filePath).then(() => {
      void openFile(filePath);
    });
  }
}

export function openFiddleForSourceFile() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !editor.document || editor.document.languageId !== 'clojure') {
    return;
  }
  const sourceFilePath = editor.document.fileName;
  const projectRootPath = state.getProjectRootUri().fsPath;
  const fiddleFilePaths = config.getConfig().fiddleFilePaths;
  const fiddleFilePath = fiddleFilesUtil.getFiddleForSourceFile(
    sourceFilePath,
    projectRootPath,
    fiddleFilePaths
  );

  const fiddleFileUri = vscode.Uri.file(fiddleFilePath);
  const relativeFiddleFilePath = vscode.workspace.asRelativePath(fiddleFileUri);
  void vscode.workspace.findFiles(relativeFiddleFilePath).then((files) => {
    if (!files.length) {
      void askToCreateANewFile(fiddleFilePath);
    } else {
      const file = files[0];
      void openFile(file);
    }
  });
}
