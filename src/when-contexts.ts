import * as vscode from 'vscode';
import { deepEqual } from './util/object';
import * as docMirror from './doc-mirror';
import * as context from './cursor-doc/cursor-context';
import * as util from './utilities';

let lastContexts: readonly context.CursorContext[] = context.allCursorContexts;

export function setCursorContextIfChanged(editor: vscode.TextEditor) {
  if (
    !editor ||
    !editor.document ||
    editor.document.languageId !== 'clojure' ||
    editor !== util.tryToGetActiveTextEditor()
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
): readonly context.CursorContext[] {
  const mirrorDoc = docMirror.getDocument(document);
  return context.determineContexts(mirrorDoc, document.offsetAt(position));
}

function setCursorContexts(currentContexts: readonly context.CursorContext[]) {
  lastContexts = currentContexts;
  context.allCursorContexts.forEach((context) => {
    void vscode.commands.executeCommand(
      'setContext',
      context,
      currentContexts.indexOf(context) > -1
    );
  });
}
