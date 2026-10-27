import * as vscode from 'vscode';
import { decideCurrentFileUri } from './current-file-decision';

/**
 * Returns the URI of the file the user is in.
 */
export function currentFileUri(): vscode.Uri | undefined {
  return decideCurrentFileUri(
    vscode.window.activeTextEditor?.document,
    vscode.window.visibleTextEditors.map((editor) => editor.document)
  );
}

/**
 * Returns the document of the file the user is in, when it is open.
 */
export function currentFileDocument(): vscode.TextDocument | undefined {
  const uri = currentFileUri()?.toString();
  return uri
    ? vscode.workspace.textDocuments.find((document) => document.uri.toString() === uri)
    : undefined;
}
