import * as vscode from 'vscode';
import * as cljsLib from '../out/cljs-lib/cljs-lib';

const editorFocusSelectionKinds = [
  vscode.TextEditorSelectionChangeKind.Keyboard,
  vscode.TextEditorSelectionChangeKind.Mouse,
];

export function hasFocus(): boolean {
  return cljsLib.replInputFocused();
}

export function activate(context: vscode.ExtensionContext) {
  cljsLib.initReplInput({
    setContext: (key: string, value: boolean) =>
      void vscode.commands.executeCommand('setContext', key, value),
  });
  context.subscriptions.push(
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
