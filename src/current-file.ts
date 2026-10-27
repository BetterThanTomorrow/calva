import * as vscode from 'vscode';
import { decideCurrentFileUri } from './current-file-decision';

let lastActiveUri: vscode.Uri | undefined;

/**
 * Returns the URI of the file the user is in.
 */
export function currentFileUri(): vscode.Uri | undefined {
  return decideCurrentFileUri(
    vscode.window.activeTextEditor?.document,
    lastActiveUri,
    vscode.window.visibleTextEditors.map((editor) => editor.document)
  );
}

/**
 * Returns the document of the file the user is in, when it is open.
 */
export function currentFileDocument(): vscode.TextDocument | undefined {
  const uri = currentFileUri()?.toString();
  return uri
    ? vscode.workspace.textDocuments.find((document) => document.uri.toString() === uri)
    : undefined;
}

function tabUris({ input }: vscode.Tab): vscode.Uri[] {
  if (input instanceof vscode.TabInputText) {
    return [input.uri];
  }
  if (input instanceof vscode.TabInputTextDiff) {
    return [input.original, input.modified];
  }
  return [];
}

function isInATab(uri: vscode.Uri): boolean {
  const key = uri.toString();
  return vscode.window.tabGroups.all.some(({ tabs }) =>
    tabs.some((tab) => tabUris(tab).some((tabUri) => tabUri.toString() === key))
  );
}

/**
 * Records the last active text editor, for when a webview or another view has the focus. It is
 * forgotten when no tab shows it any more.
 */
export function activate(context: vscode.ExtensionContext) {
  lastActiveUri = decideCurrentFileUri(vscode.window.activeTextEditor?.document, undefined);
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      lastActiveUri = decideCurrentFileUri(editor?.document, lastActiveUri);
    }),
    vscode.window.tabGroups.onDidChangeTabs(({ closed }) => {
      if (closed.length > 0 && lastActiveUri && !isInATab(lastActiveUri)) {
        lastActiveUri = undefined;
      }
    })
  );
}
