import * as vscode from 'vscode';

export async function init(context: vscode.ExtensionContext) {
  // Create the repl output markdown file
  const fileName = 'repl-output.md';
  const wsedit = new vscode.WorkspaceEdit();
  const wsPath = vscode.workspace.workspaceFolders[0].uri.fsPath; // gets the path of the first workspace folder
  const filePath = vscode.Uri.file(wsPath + '/' + fileName);
  void vscode.window.showInformationMessage(filePath.toString());
  wsedit.createFile(filePath, { ignoreIfExists: true });
  await vscode.workspace.applyEdit(wsedit);
  void vscode.window.showInformationMessage('Created a new file: repl-output.md');
}
