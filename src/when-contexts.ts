import * as vscode from 'vscode';
import * as cljsLib from '../out/cljs-lib/cljs-lib';
import * as objectUtil from './util/object';
import * as docMirror from './doc-mirror';
import * as context from './cursor-doc/cursor-context';
import * as util from './utilities';
import * as namespace from './namespace';
import * as session from './nrepl/repl-session';
import * as sessionRegistry from './nrepl/session-registry';
import * as state from './state';

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
      // While the REPL Input is the current editor, `calva:ns` is its context's namespace
      if (baselineEditor === newEditor && !cljsLib.replInputFocused()) {
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

export function setCursorContextIfChanged(editor: vscode.TextEditor): boolean {
  if (
    !editor ||
    !editor.document ||
    editor.document.languageId !== 'clojure' ||
    editor !== util.tryToGetActiveTextEditor()
  ) {
    return false;
  }
  const contexts = determineCursorContexts(editor.document, editor.selections[0].active);
  setCursorContexts(contexts);
  setNsCursorContextSoon(editor, editor.document, editor.selections[0].active);
  const sessionType = session.getSessionKey();
  void vscode.commands.executeCommand('setContext', 'calva:replSessionType', sessionType);
  setProjectRootContext();
  setCljsTypeContext();
  return true;
}

/**
 * Sets `calva:projectRoot` to the project root, as an fsPath, of the session the
 * active editor routes to. Unset when no session is routed.
 */
export function setProjectRootContext() {
  const sessionKey = session.getSessionKey();
  const projectRoot = sessionKey
    ? sessionRegistry.getSessionMetadata(sessionKey)?.projectRoot
    : undefined;
  void vscode.commands.executeCommand(
    'setContext',
    'calva:projectRoot',
    projectRoot ? vscode.Uri.parse(projectRoot).fsPath : undefined
  );
}

/**
 * Sets `calva:ns`, `calva:replSessionType` and `calva:projectRoot` for the current editor: the
 * REPL Input, with its context's namespace `replInputNs`, while it is the current editor, else the
 * active editor.
 */
export function setCurrentEditorContexts(replInputNs: string | null) {
  void vscode.commands.executeCommand(
    'setContext',
    'calva:replSessionType',
    session.getSessionKey()
  );
  setProjectRootContext();
  if (replInputNs !== null) {
    void vscode.commands.executeCommand('setContext', 'calva:ns', replInputNs);
    return;
  }
  const editor = util.tryToGetActiveTextEditor();
  if (editor?.document.languageId === 'clojure') {
    setNsCursorContextSoon(editor, editor.document, editor.selections[0].active);
  }
}

function determineCursorContexts(
  document: vscode.TextDocument,
  position: vscode.Position
): context.CursorContext[] {
  const mirrorDoc = docMirror.tryToGetDocument(document);
  if (!mirrorDoc) {
    return [];
  }
  return context.determineContexts(mirrorDoc, document.offsetAt(position));
}

function setCursorContexts(contexts: context.CursorContext[]) {
  lastContexts = currentContexts;
  currentContexts = contexts;
  context.allCursorContexts.forEach((context) => {
    void vscode.commands.executeCommand('setContext', context, contexts.indexOf(context) > -1);
  });
}

export function setCljsTypeContext() {
  const isConnected = util.getConnectedState();
  const cljsTypeName = state.extensionContext.workspaceState.get('selectedCljsTypeName');

  // Set the actual CLJS type as context value
  void vscode.commands.executeCommand(
    'setContext',
    'calva:cljsType',
    isConnected ? cljsTypeName : null
  );
}
