import * as vscode from 'vscode';
import * as cljsLib from '../out/cljs-lib/cljs-lib';
import * as format from './calva-fmt/src/format';
import * as config from './config';
import type * as model from './cursor-doc/model';
import * as paredit from './cursor-doc/paredit';
import * as formatterConfig from './formatter-config';
import * as namespace from './namespace';
import * as replSession from './nrepl/repl-session';
import * as sessionRegistry from './nrepl/session-registry';
import * as replInputDocument from './repl-input-document';
import * as replWindow from './repl-window/repl-window-doc';
import * as whenContexts from './when-contexts';

const editorFocusSelectionKinds = [
  vscode.TextEditorSelectionChangeKind.Keyboard,
  vscode.TextEditorSelectionChangeKind.Mouse,
];

export function hasFocus(): boolean {
  return cljsLib.replInputFocused();
}

export function editFocused(f: (doc: model.StringDocument) => unknown): Promise<void> {
  return cljsLib.replInputEditFocused(f);
}

const editorCommands = [
  'undo',
  'redo',
  'cursorUndo',
  'addSelectionToNextFindMatch',
  'selectHighlights',
  'insertCursorAbove',
  'insertCursorBelow',
  'insertCursorAtEndOfEachLineSelected',
  'commentLine',
  'moveLinesUp',
  'moveLinesDown',
  'copyLinesUp',
  'copyLinesDown',
  'deleteLines',
  'indentLines',
  'outdentLines',
  'joinLines',
];

function editWithOneCursor(f: (doc: model.StringDocument) => unknown) {
  return editFocused((doc) => (doc.selections.length === 1 ? f(doc) : undefined));
}

function formatAtCursors(doc: model.StringDocument) {
  const { text } = replInputDocument.documentState(doc);
  replInputDocument.applyChanges(doc, format.formatAtCursorsChanges(doc, text));
}

/** Reformats `ranges` of a REPL Input document one at a time, as `reformatRanges` in `edit.ts` does in an editor. */
export function reformatRanges(doc: model.StringDocument, ranges: [number, number][]) {
  for (const [start, end] of ranges) {
    const { text } = replInputDocument.documentState(doc);
    replInputDocument.applyChanges(
      doc,
      format.documentRangeReformatChanges(doc, vscode.EndOfLine.LF, {
        startIndex: start,
        startColumn: doc.model.getRowCol(start)[1],
        originalText: text.substring(start, end),
        fullDocument: start === 0 && end === text.length,
      })
    );
  }
}

const isClojureFile = (document: vscode.TextDocument | undefined) =>
  document?.languageId === 'clojure' && !replWindow.isReplWindowDoc(document);

function followEditor(editor: vscode.TextEditor | undefined) {
  if (editor === vscode.window.activeTextEditor && isClojureFile(editor?.document)) {
    cljsLib.replInputEditorMoved(editor.document, editor.selection.active);
  }
}

const contextAdapter = {
  editorNamespace: (doc: vscode.TextDocument, position: vscode.Position) =>
    namespace.getNamespace(doc, position),
  // A null document routes without one, where undefined falls back to the active editor
  routedSessionKey: (doc: vscode.TextDocument | null) =>
    replSession.getRoutingInfo(doc)?.sessionKey,
  sessionKeys: () => sessionRegistry.listSessions().map(({ key }) => key),
};

export function activate(context: vscode.ExtensionContext) {
  cljsLib.initReplInput({
    ...contextAdapter,
    setContext: (key: string, value: boolean) =>
      void vscode.commands.executeCommand('setContext', key, value),
    document: replInputDocument.stringDocument,
    documentState: replInputDocument.documentState,
    cursorContexts: replInputDocument.cursorContexts,
    brackets: (
      doc: model.StringDocument,
      options: { colorCount: number; cycleBracketColors: boolean }
    ) => {
      const { customCommentForms, aliasMap } = config.getConfig();
      return replInputDocument.brackets(doc, {
        ...options,
        commentFormConfig: { customCommentForms, aliasMap },
      });
    },
    restoreEditorCursorContexts: () =>
      whenContexts.setCursorContextIfChanged(vscode.window.activeTextEditor),
  });
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.replInput.deleteBackward', () =>
      editWithOneCursor((doc) => paredit.backspace(doc, undefined, formatterConfig.getConfigNow()))
    ),
    vscode.commands.registerCommand('calva.replInput.deleteForward', () =>
      editWithOneCursor((doc) => paredit.deleteForward(doc))
    ),
    vscode.commands.registerCommand('calva.replInput.newLine', () =>
      editFocused((doc) => replInputDocument.newLine(doc, formatterConfig.getConfigNow()))
    ),
    vscode.commands.registerCommand('calva.replInput.formatCurrentForm', () =>
      editFocused(formatAtCursors)
    ),
    vscode.commands.registerCommand('calva.replInput.insertLineAfter', () =>
      editFocused((doc) => replInputDocument.insertLineAfter(doc, formatterConfig.getConfigNow()))
    ),
    vscode.commands.registerCommand('calva.replInput.insertLineBefore', () =>
      editFocused((doc) => replInputDocument.insertLineBefore(doc, formatterConfig.getConfigNow()))
    ),
    vscode.commands.registerCommand('calva.replInput.expandSelection', () =>
      vscode.commands.executeCommand('paredit.sexpRangeExpansion')
    ),
    vscode.commands.registerCommand('calva.replInput.shrinkSelection', () =>
      vscode.commands.executeCommand('paredit.sexpRangeContraction')
    ),
    ...editorCommands.map((name) =>
      vscode.commands.registerCommand(`calva.replInput.${name}`, () =>
        cljsLib.replInputRunInFocused(name)
      )
    ),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        cljsLib.replInputTextEditorFocused();
      }
      followEditor(editor);
    }),
    vscode.window.onDidChangeTextEditorSelection(({ kind, textEditor }) => {
      if (editorFocusSelectionKinds.includes(kind)) {
        cljsLib.replInputTextEditorFocused();
      }
      followEditor(textEditor);
    })
  );
  followEditor(vscode.window.activeTextEditor);
}
