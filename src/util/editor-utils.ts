import * as vscode from 'vscode';

export function isTextEditor(x: vscode.TextEditor | vscode.TextDocument): x is vscode.TextEditor {
  return 'edit' in x;
}
