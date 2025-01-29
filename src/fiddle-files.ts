import * as vscode from 'vscode';
import * as fiddleFilesUtil from './util/fiddle-files';
import * as state from './state';
import * as config from './config';
import * as nsUtil from './util/ns-form';
import eval from './evaluate';
import * as path from 'path';
import * as namespace from './namespace';
import * as outputWindow from './repl-window/repl-doc';
import * as output from './results-output/output';

// TODO: This viewColumn memory could probably be a shared thing for all of Calva.
//       At least the REPL window has similar functionality an could benefit from this more general approach.
const filePathToViewColumn: Map<string, vscode.ViewColumn> = new Map();
const filePathToSelection: Map<string, vscode.Selection> = new Map();

export let activeEditorIsFiddle = false;

export function updateFiddleFileOpenedContext(editor: vscode.TextEditor) {
  if (!editor || !editor.document || editor.document.languageId !== 'clojure') {
    return;
  }
  activeEditorIsFiddle = fiddleFilesUtil.isFiddleFile(
    editor.document.fileName,
    state.getProjectRootUri()?.fsPath,
    config.getConfig().fiddleFilePaths
  );
  void vscode.commands.executeCommand(
    'setContext',
    'calva:activeEditorIsFiddle',
    activeEditorIsFiddle
  );
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      updateFiddleFileOpenedContext(editor);
      if (editor && editor.document && editor.document.languageId === 'clojure') {
        filePathToViewColumn.set(editor.document.fileName, editor.viewColumn);
      }
    }),
    vscode.window.onDidChangeTextEditorSelection((e) => {
      const editor = e.textEditor;
      if (editor && e.selections.length > 0) {
        filePathToSelection.set(editor.document.fileName, e.selections[0]);
      }
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('calva.fiddleFilePaths')) {
        updateFiddleFileOpenedContext(vscode.window.activeTextEditor);
      }
    })
  );
  updateFiddleFileOpenedContext(vscode.window.activeTextEditor);

  // Best effort to initialize view column for source and fiddle files
  // Only visible editors are considered, the API does not provide a way to get the view column for a non-visible editor
  for (const editor of vscode.window.visibleTextEditors) {
    filePathToViewColumn.set(editor.document.fileName, editor.viewColumn);
  }
}

// TODO: Much of this file opening/creation code started as copies of functions from file-switcher.ts.
//       We can probably refactor to share code.
async function openFile(filePath: string) {
  const fileUri: vscode.Uri = vscode.Uri.file(filePath);
  const doc = await vscode.workspace.openTextDocument(fileUri);
  return await vscode.window.showTextDocument(doc, {
    preserveFocus: false,
    viewColumn: filePathToViewColumn.get(filePath) || null,
  });
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

function getFiddleForSourceFile() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !editor.document || editor.document.languageId !== 'clojure') {
    return { fiddleFileUri: null, fiddleFilePath: null };
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
  return { fiddleFileUri, fiddleFilePath };
}

export function openFiddleForSourceFile() {
  const { fiddleFileUri, fiddleFilePath } = getFiddleForSourceFile();
  if (!fiddleFileUri) {
    return;
  }
  const relativeFiddleFilePath = vscode.workspace.asRelativePath(fiddleFileUri);
  void vscode.workspace.findFiles(relativeFiddleFilePath).then((files) => {
    if (!files.length) {
      void askToCreateANewFile(fiddleFilePath);
    } else {
      void openFile(files[0].fsPath);
    }
  });
}

export async function evaluateFiddleForSourceFile() {
  const { fiddleFileUri, fiddleFilePath } = getFiddleForSourceFile();
  if (!fiddleFileUri) {
    return;
  }
  try {
    const doc = await vscode.workspace.openTextDocument(fiddleFileUri);
    const relativeFiddleFilePath = vscode.workspace.asRelativePath(fiddleFileUri);
    const code = doc.getText();
    const fiddleSelection = filePathToSelection.get(fiddleFilePath);
    const p = fiddleSelection ? doc.offsetAt(fiddleSelection.active) : 0;
    const [ns, nsForm] = nsUtil.nsFromText(code, p) || namespace.getDocumentNamespace();
    output.appendLineOtherOut(`Evaluating fiddle: ${relativeFiddleFilePath}`);
    await eval.evaluateInOutputWindow(code, path.extname(fiddleFilePath).replace(/^\./, ''), ns, {
      nsForm,
    });
    return new Promise((resolve) => {
      output.replWindowAppendPrompt(resolve);
    });
  } catch (e) {
    openFiddleForSourceFile();
  }
}

export async function openSourceFileForFiddle() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !editor.document || editor.document.languageId !== 'clojure') {
    return;
  }
  const filePath = editor.document.fileName;
  const projectRootPath = state.getProjectRootUri().fsPath;
  const fiddleFilePaths = config.getConfig().fiddleFilePaths;
  const sourceFilePath = await fiddleFilesUtil.getSourceForFiddleFile(
    filePath,
    projectRootPath,
    fiddleFilePaths,
    vscode.workspace
  );

  if (!sourceFilePath) {
    void vscode.window.showInformationMessage(
      "This fiddle file can't be mapped to a source file. Consider using the Go Previous command to toggle between files.",
      'OK'
    );
    return;
  }

  const sourceFileUri = vscode.Uri.file(sourceFilePath);
  const relativeSourceFilePath = vscode.workspace.asRelativePath(sourceFileUri);
  void vscode.workspace.findFiles(relativeSourceFilePath).then((files) => {
    if (files.length) {
      void openFile(files[0].fsPath);
    } else {
      void vscode.window.showInformationMessage(
        'The source file for this fiddle does not exist. You need to create it manually.',
        'OK'
      );
    }
  });
}
