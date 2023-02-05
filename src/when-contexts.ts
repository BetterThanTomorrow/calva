import vscode from 'vscode';
import { deepEqual } from './util/object';
import { getDocument } from './doc-mirror';
import { allCursorContexts, CursorContext, determineContexts } from './cursor-doc/cursor-context';
import { tryToGetActiveTextEditor } from './utilities';

let lastContexts: CursorContext[] = [];

export function setCursorContextIfChanged(editor: vscode.TextEditor) {
  if (
    !editor ||
    !editor.document ||
    editor.document.languageId !== 'clojure' ||
    editor !== tryToGetActiveTextEditor()
  ) {
    return;
  }
  const currentContexts = determineCursorContexts(editor.document, editor.selection.active);
  if (!deepEqual(lastContexts, currentContexts)) {
    setCursorContexts(currentContexts);
  }
}

function determineCursorContexts(
  document: vscode.TextDocument,
  position: vscode.Position
): CursorContext[] {
  const mirrorDoc = getDocument(document);
  return determineContexts(mirrorDoc, document.offsetAt(position));
}

function setCursorContexts(currentContexts: CursorContext[]) {
  lastContexts = currentContexts;
  allCursorContexts.forEach((context) => {
    void vscode.commands.executeCommand(
      'setContext',
      context,
      currentContexts.indexOf(context) > -1
    );
  });
}
