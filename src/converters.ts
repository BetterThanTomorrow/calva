import * as vscode from 'vscode';
import * as calvaLib from '../out/cljs-lib/cljs-lib';

type Js2CljsResult = {
  result: string;
};

type Js2CljsException = {
  name: string;
  message: string;
};

type JS2CljsError = {
  exception: Js2CljsException;
  message: string;
  'number-of-parsed-lines': number;
};

type Js2CljsInvalidResult = {
  error: JS2CljsError;
};

const isJs2CljsResult = (input: any): input is Js2CljsResult => input.result !== undefined;

export async function js2cljs() {
  const editor = vscode.window.activeTextEditor;
  const selection = editor.selection;
  const doc = editor.document;
  const js = doc.getText(
    selection.active.isEqual(selection.anchor)
      ? new vscode.Range(doc.positionAt(0), doc.positionAt(Infinity))
      : new vscode.Range(selection.start, selection.end)
  );
  const results: Js2CljsResult | Js2CljsInvalidResult = calvaLib.jsify(calvaLib.js2cljs(js));
  if (isJs2CljsResult(results)) {
    await vscode.workspace
      .openTextDocument({ language: 'clojure', content: results.result })
      .then(async (doc) => {
        await vscode.window.showTextDocument(doc, {
          preview: false,
          preserveFocus: false,
        });
      });
  } else {
    void vscode.window.showErrorMessage(results.error.message, {
      modal: true,
      detail: `${results.error.exception.name}: ${results.error.exception.message}`,
    });
  }
}
