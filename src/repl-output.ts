import * as vscode from 'vscode';
import * as fs from 'fs/promises';

export async function init(context: vscode.ExtensionContext) {
  // Create the repl output markdown file
  const fileName = 'repl-output.md';
  const wsedit = new vscode.WorkspaceEdit();
  const wsPath = vscode.workspace.workspaceFolders[0].uri.fsPath; // gets the path of the first workspace folder
  const filePath = vscode.Uri.file(wsPath + '/' + fileName);
  wsedit.createFile(filePath, { ignoreIfExists: true });
  await vscode.workspace.applyEdit(wsedit);
  //void vscode.window.showInformationMessage('Created a new file: ' + fileName);

  await vscode.commands.executeCommand('markdown.showPreviewToSide', filePath);

  setInterval(async () => {
    await fs.appendFile(filePath.fsPath, '\n```clojure\n(+ 1 2 3 4 5)\n```');
  }, 500);
}
