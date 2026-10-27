import type * as vscode from 'vscode';

export type EditorDocument = Pick<vscode.TextDocument, 'uri' | 'languageId'>;

function isFileDocument(document: EditorDocument | undefined): boolean {
  return (
    document !== undefined && document.uri.scheme !== 'output' && document.languageId !== 'Log'
  );
}

/**
 * Returns the URI of the first of `documents` that is a file. Output channels are skipped.
 */
export function firstFileUri(documents: (EditorDocument | undefined)[]): vscode.Uri | undefined {
  return documents.find(isFileDocument)?.uri;
}

/**
 * Returns the URI of the file the user is in: the active editor's. When no text editor is
 * active, `lastActiveUri`, or without it, the first of the `visible` editors'.
 */
export function decideCurrentFileUri(
  active: EditorDocument | undefined,
  lastActiveUri: vscode.Uri | undefined,
  visible: EditorDocument[] = []
): vscode.Uri | undefined {
  return firstFileUri([active]) ?? lastActiveUri ?? firstFileUri(visible);
}
