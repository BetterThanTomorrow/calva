import * as vscode from 'vscode';
import * as calvaLib from '../out/cljs-lib/cljs-lib';
import * as config from './config';

type ConverterResult = {
  result: string;
};

type ConverterException = {
  name: string;
  message: string;
};

type JS2CljsError = {
  exception: ConverterException;
  message: string;
  'number-of-parsed-lines': number;
};

type DartClojureError = {
  exception: ConverterException;
  message: string;
};

type ConverterInvalidResult = {
  error: JS2CljsError | DartClojureError;
};

const isConverterResult = (input: any): input is ConverterResult => input.result !== undefined;

type ConvertFn = (code: string, options?: any) => ConverterResult | ConverterInvalidResult;

async function convertToUntitled(convertFn: ConvertFn, code?: string, options?: any) {
  const editor = vscode.window.activeTextEditor;
  const selection = editor.selection;
  const doc = editor.document;
  code = code
    ? code
    : doc.getText(
        selection.active.isEqual(selection.anchor)
          ? new vscode.Range(doc.positionAt(0), doc.positionAt(Infinity))
          : new vscode.Range(selection.start, selection.end)
      );
  const results: ConverterResult | ConverterInvalidResult = calvaLib.jsify(
    options ? convertFn(code, options) : convertFn(code)
  );
  if (isConverterResult(results)) {
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

export async function js2cljs() {
  return convertToUntitled(calvaLib.js2cljs);
}

export async function dart2clj() {
  return convertToUntitled(calvaLib.dart2clj);
}

export type HiccupOptions = {
  'kebab-attrs?': boolean;
  'mapify-style?': boolean;
};

export type Html2HiccupArgs = {
  toUntitled?: boolean;
  html?: string;
  options?: HiccupOptions;
};

export async function html2hiccup(args?: Html2HiccupArgs) {
  if (!args) {
    return convertToUntitled(
      calvaLib.html2hiccup,
      undefined,
      config.getConfig().html2HiccupOptions
    );
  }
  if (args?.toUntitled) {
    if (args?.html) {
      return convertToUntitled(calvaLib.html2hiccup, args.html, args?.options);
    }
    return convertToUntitled(calvaLib.html2hiccup, undefined, args?.options);
  }
  if (args?.html) {
    return calvaLib.html2hiccup(args.html, args?.options);
  }
  throw new Error('No HTML provided');
}
