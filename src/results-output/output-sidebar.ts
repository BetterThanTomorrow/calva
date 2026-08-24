import * as vscode from 'vscode';
import * as cljsLib from '../../out/cljs-lib/cljs-lib';

export function registerReplOutputSidebarProvider(context: vscode.ExtensionContext) {
  const provider = cljsLib.createReplOutputSidebarProvider();
  const disposable = vscode.window.registerWebviewViewProvider('calva.output-sidebar', provider, {
    webviewOptions: { retainContextWhenHidden: true },
  });
  context.subscriptions.push(disposable);
}
