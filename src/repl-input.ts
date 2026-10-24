import * as vscode from 'vscode';
import * as cljsLib from '../out/cljs-lib/cljs-lib';
import type * as model from './cursor-doc/model';
import * as paredit from './cursor-doc/paredit';
import * as formatterConfig from './formatter-config';
import * as replInputDocument from './repl-input-document';
import * as whenContexts from './when-contexts';

const editorFocusSelectionKinds = [
  vscode.TextEditorSelectionChangeKind.Keyboard,
  vscode.TextEditorSelectionChangeKind.Mouse,
];

export function hasFocus(): boolean {
  return cljsLib.replInputFocused();
}

export function editFocused(f: (doc: model.EditableDocument) => unknown): Promise<void> {
  return cljsLib.replInputEditFocused(f);
}

function editWithOneCursor(f: (doc: model.EditableDocument) => unknown) {
  return editFocused((doc) => (doc.selections.length === 1 ? f(doc) : undefined));
}

export function activate(context: vscode.ExtensionContext) {
  cljsLib.initReplInput({
    setContext: (key: string, value: boolean) =>
      void vscode.commands.executeCommand('setContext', key, value),
    document: replInputDocument.stringDocument,
    documentState: replInputDocument.documentState,
    cursorContexts: replInputDocument.cursorContexts,
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
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        cljsLib.replInputTextEditorFocused();
      }
    }),
    vscode.window.onDidChangeTextEditorSelection(({ kind }) => {
      if (editorFocusSelectionKinds.includes(kind)) {
        cljsLib.replInputTextEditorFocused();
      }
    })
  );
}
