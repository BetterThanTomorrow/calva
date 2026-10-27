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

/** The REPL Input while it is the current editor, with the source file of its context. */
export type ReplInputEditor = { sourceFile: vscode.Uri | undefined };

/**
 * Returns the URI of the file the user is in: the `replInput`'s source file while it is the
 * current editor, else the active editor's. When no text editor is active, `lastActiveUri`, or
 * without it, the first of the `visible` editors'.
 */
export function decideCurrentFileUri(
  active: EditorDocument | undefined,
  lastActiveUri: vscode.Uri | undefined,
  visible: EditorDocument[] = [],
  replInput?: ReplInputEditor
): vscode.Uri | undefined {
  if (replInput) {
    return replInput.sourceFile;
  }
  return firstFileUri([active]) ?? lastActiveUri ?? firstFileUri(visible);
}
