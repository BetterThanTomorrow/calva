import * as vscode from 'vscode';
import { deepEqual } from './util/object';
import * as docMirror from './doc-mirror';
import * as context from './cursor-doc/cursor-context';
import * as util from './utilities';

let lastContexts: context.CursorContext[] = [];

export function setCursorContextIfChanged(editor: vscode.TextEditor | undefined) {
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
): context.CursorContext[] {
  const mirrorDoc = docMirror.getDocument(document);
  return context.determineContexts(mirrorDoc, document.offsetAt(position));
}

function setCursorContexts(currentContexts: context.CursorContext[]) {
  lastContexts = currentContexts;
  context.allCursorContexts.forEach((context) => {
    void vscode.commands.executeCommand(
      'setContext',
      context,
      currentContexts.indexOf(context) > -1
    );
  });
}
