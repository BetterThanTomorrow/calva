import * as vscode from 'vscode';
import { deepEqual } from './util/object';
import * as docMirror from './doc-mirror';
import * as context from './cursor-doc/cursor-context';
import * as util from './utilities';
import * as namespace from './namespace';
import * as session from './nrepl/repl-session';
import { cljsLib } from './utilities';

/* Determining the "calva:ns" cursor context takes time,
so figure it out after x milliseconds of quiet. */

const nsCursorContextDelayMs = 800;

/*
Quiet means no changes to document content or cursor position.
So whenever either of those changes: 
- Set a new timer for x milliseconds and cancel any outstanding timer. 
- When the timer expires, 
-- if the relevant document is still active, 
--- Calculate calva:ns
--- Put it in effect with setContext
One timer is sufficient to cover all documents.
*/

const setNsCursorContextSoon = (function () {
  let nsCursorContextTimer = undefined;
  return function (
    baselineEditor: vscode.TextEditor,
    baselineDocument: vscode.TextDocument,
    baselinePosition: vscode.Position
  ): void {
    const baselineVersion = baselineDocument.version;
    if (nsCursorContextTimer) {
      clearTimeout(nsCursorContextTimer);
    }
    nsCursorContextTimer = setTimeout(function () {
      const newEditor = util.tryToGetActiveTextEditor();
      if (baselineEditor === newEditor) {
        if (baselineDocument === newEditor.document) {
          if (baselineVersion == newEditor.document.version) {
            if (baselinePosition == newEditor.selections[0].active) {
              const [ns, _form] = namespace.getNamespace(baselineEditor.document, baselinePosition);
              void vscode.commands.executeCommand('setContext', 'calva:ns', ns);
            }
          }
        }
      }
    }, nsCursorContextDelayMs);
  };
})();

export let lastContexts: context.CursorContext[] = [];
export let currentContexts: context.CursorContext[] = [];

export function setCursorContextIfChanged(editor: vscode.TextEditor) {
  if (
    !editor ||
    !editor.document ||
    editor.document.languageId !== 'clojure' ||
    editor !== util.tryToGetActiveTextEditor()
  ) {
    return;
  }
  const contexts = determineCursorContexts(editor.document, editor.selections[0].active);
  setCursorContexts(contexts);
  setNsCursorContextSoon(editor, editor.document, editor.selections[0].active);
  const sessionType = session.getReplSessionType(cljsLib.getStateValue('connected'));
  void vscode.commands.executeCommand('setContext', 'calva:replSessionType', sessionType);
}

function determineCursorContexts(
  document: vscode.TextDocument,
  position: vscode.Position
): context.CursorContext[] {
  const mirrorDoc = docMirror.getDocument(document);
  return context.determineContexts(mirrorDoc, document.offsetAt(position));
}

function setCursorContexts(contexts: context.CursorContext[]) {
  lastContexts = currentContexts;
  currentContexts = contexts;
  context.allCursorContexts.forEach((context) => {
    void vscode.commands.executeCommand('setContext', context, contexts.indexOf(context) > -1);
  });
}
