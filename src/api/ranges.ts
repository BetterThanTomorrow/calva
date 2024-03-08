import * as vscode from 'vscode';
import * as getText from '../util/get-text';

const wrapSelectionAndTextFunction = (
  f: (document: vscode.TextDocument, position: vscode.Position) => [vscode.Range, string]
) => {
  return (editor = vscode.window.activeTextEditor, position = editor?.selections?.[0]?.active) => {
    if (editor && position && editor.document && editor.document.languageId === 'clojure') {
      return f(editor.document, position);
    } else {
      return [undefined, undefined];
    }
  };
};

export const currentForm = wrapSelectionAndTextFunction(getText.currentFormText);
export const currentEnclosingForm = wrapSelectionAndTextFunction(getText.currentEnclosingFormText);
export const currentTopLevelForm = wrapSelectionAndTextFunction(getText.currentTopLevelFormText);
export const currentFunction = wrapSelectionAndTextFunction(getText.currentFunction);
export const currentTopLevelDef = wrapSelectionAndTextFunction(getText.currentTopLevelDefined);
