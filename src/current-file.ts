import * as vscode from 'vscode';
import * as cljsLib from '../out/cljs-lib/cljs-lib';
import { decideCurrentFileUri, type ReplInputEditor } from './current-file-decision';

let lastActiveUri: vscode.Uri | undefined;

function replInputEditor(): ReplInputEditor | undefined {
  if (cljsLib.replInputFocused()) {
    const sourceFile: string | null = cljsLib.replInputSourceFile();
    return { sourceFile: sourceFile ? vscode.Uri.parse(sourceFile) : undefined };
  }
}

function fileUri(replInput?: ReplInputEditor): vscode.Uri | undefined {
  return decideCurrentFileUri(
    vscode.window.activeTextEditor?.document,
    lastActiveUri,
    vscode.window.visibleTextEditors.map((editor) => editor.document),
    replInput
  );
}

function openDocument(uri: vscode.Uri | undefined): vscode.TextDocument | undefined {
  const key = uri?.toString();
  return key
    ? vscode.workspace.textDocuments.find((document) => document.uri.toString() === key)
    : undefined;
}

/**
 * Returns the URI of the file the user is in, the REPL Input's source file while it is the current
 * editor.
 */
export function currentFileUri(): vscode.Uri | undefined {
  return fileUri(replInputEditor());
}

/**
 * Returns the session key that the REPL Input's lock keeps while the REPL Input is the current
 * editor, which a lock without a source file does. Evaluating from the REPL Input goes there.
 */
export function currentReplInputSessionKey(): string | undefined {
  return (cljsLib.replInputFocused() && cljsLib.replInputKeptSessionKey()) || undefined;
}

/**
 * Returns the document of the file the user is in, when it is open.
 */
export function currentFileDocument(): vscode.TextDocument | undefined {
  return openDocument(currentFileUri());
}

/**
 * Returns the document of the active editor, or of the last active one while a webview or another
 * view has the focus, when it is open. Commands on a file's text act on it.
 */
export function activeEditorDocument(): vscode.TextDocument | undefined {
  return openDocument(fileUri());
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
    vscode.window.tabGroups.onDidChangeTabs(() => {
      if (lastActiveUri && !isInATab(lastActiveUri)) {
        lastActiveUri = undefined;
      }
    })
  );
}
