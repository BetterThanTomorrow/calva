import * as vscode from 'vscode';
import * as calvaLib from '../out/cljs-lib/cljs-lib';
import * as config from './config';

function getText() {
  const editor = vscode.window.activeTextEditor;
  const selection = editor.selections[0];
  const doc = editor.document;
  return doc.getText(
    selection.active.isEqual(selection.anchor)
      ? new vscode.Range(doc.positionAt(0), doc.positionAt(Infinity))
      : new vscode.Range(selection.start, selection.end)
  );
}

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

type ConversionError = {
  exception: ConverterException;
  message: string;
};

type ConverterInvalidResult = {
  error: JS2CljsError | ConversionError;
};

const isConverterResult = (input: any): input is ConverterResult => input.result !== undefined;

type ConvertFn = (code: string, options?: any) => ConverterResult | ConverterInvalidResult;

async function convertToUntitled(convertFn: ConvertFn, code: string, options?: any) {
  const results: ConverterResult | ConverterInvalidResult = options
    ? convertFn(code, options)
    : convertFn(code);
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
  return convertToUntitled(calvaLib.js2cljs, getText());
}

export async function dart2clj() {
  return convertToUntitled(calvaLib.dart2clj, getText());
}

export type HiccupOptions = {
  'kebab-attrs?': boolean;
  'mapify-style?': boolean;
  'add-classes-to-tag-keyword?': boolean;
};

function hasHiccupOptions(options: any): boolean {
  return (
    options &&
    (options['kebab-attrs?'] !== undefined ||
      options['mapify-style?'] !== undefined ||
      options['add-classes-to-tag-keyword?'] !== undefined)
  );
}

export async function html2hiccup(args?: {
  toUntitled?: boolean;
  html?: string;
  options?: HiccupOptions;
}) {
  const hiccupOptions =
    args?.options && hasHiccupOptions(args.options)
      ? args.options
      : config.getConfig().html2HiccupOptions;
  const html = args?.html ? args.html : getText();
  if (!args || args?.toUntitled) {
    return convertToUntitled(calvaLib.html2hiccup, html, hiccupOptions);
  }
  return calvaLib.html2hiccup(html, hiccupOptions);
}

export async function pasteHtmlAsHiccup(options?: HiccupOptions) {
  const hiccupOptions = hasHiccupOptions(options) ? options : config.getConfig().html2HiccupOptions;
  const html = await vscode.env.clipboard.readText();
  const results: ConverterResult | ConverterInvalidResult = calvaLib.html2hiccup(
    html,
    hiccupOptions
  );
  if (isConverterResult(results)) {
    await vscode.env.clipboard.writeText(results.result);
    await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
    return vscode.env.clipboard.writeText(html);
  }
  return vscode.window.showErrorMessage(results.error.message, {
    modal: true,
    detail: `${results.error.exception.name}: ${results.error.exception.message}`,
  });
}

export async function copyHtmlAsHiccup(options?: HiccupOptions) {
  const hiccupOptions = hasHiccupOptions(options) ? options : config.getConfig().html2HiccupOptions;
  const html = getText();
  const results: ConverterResult | ConverterInvalidResult = calvaLib.html2hiccup(
    html,
    hiccupOptions
  );
  if (isConverterResult(results)) {
    return vscode.env.clipboard.writeText(results.result);
  }
  return vscode.window.showErrorMessage(results.error.message, {
    modal: true,
    detail: `${results.error.exception.name}: ${results.error.exception.message}`,
  });
}
