import type * as vscode from 'vscode';

export type EditorDocument = Pick<vscode.TextDocument, 'uri' | 'languageId'>;

function isFileDocument(document: EditorDocument | undefined): boolean {
  return document !== undefined && document.languageId !== 'Log';
}

/**
 * Returns the URI of the file the user is in: the active editor's, or the first
 * visible editor's when no text editor is active. Output channels are skipped.
 */
export function decideCurrentFileUri(
  active: EditorDocument | undefined,
  visible: EditorDocument[]
): vscode.Uri | undefined {
  return [active, ...visible].find(isFileDocument)?.uri;
}
