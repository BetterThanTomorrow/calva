import * as vscode from 'vscode';
import * as getText from '../util/get-text';
import { resolveDocAndPos } from '../util/resolve-doc-and-pos';

const wrapSelectionAndTextFunction = (
  f: (document: vscode.TextDocument, position: vscode.Position) => [vscode.Range, string]
) => {
  return (editorOrDoc?: vscode.TextEditor | vscode.TextDocument, position?: vscode.Position) => {
    const resolved = resolveDocAndPos(editorOrDoc, position, vscode.window.activeTextEditor);
    if (!resolved) {
      return [undefined, undefined];
    }
    return f(resolved.doc as vscode.TextDocument, resolved.pos as vscode.Position);
  };
};

export const currentForm = wrapSelectionAndTextFunction(getText.currentFormText);
export const currentEnclosingForm = wrapSelectionAndTextFunction(getText.currentEnclosingFormText);
export const currentTopLevelForm = wrapSelectionAndTextFunction(getText.currentTopLevelFormText);
export const currentFunction = wrapSelectionAndTextFunction(getText.currentFunction);
export const currentTopLevelDef = wrapSelectionAndTextFunction(getText.currentTopLevelDefined);
