import * as vscode from 'vscode';
import type { CompletionItem } from 'vscode-languageserver-protocol';
import * as vscodeLsp from 'vscode-languageclient/node';
import type * as model from './cursor-doc/model';
import * as lspState from './lsp/state';
import * as replInputCopy from './lsp/repl-input-copy';
import * as sessionRegistry from './nrepl/session-registry';
import * as completion from './providers/completion';
import * as completionUtil from './providers/completion-util';
import * as replCompletion from './providers/repl-completion';

type MergeableItems = Parameters<typeof completionUtil.mergeCompletions>[0];

/** The clojure-lsp client for the followed file at `uri`, or for the first workspace folder. */
export function lspClient(uri: vscode.Uri | undefined) {
  const clientUri = uri ?? vscode.workspace.workspaceFolders?.[0]?.uri;
  return clientUri && lspState.getClientProvider().getClientForDocumentUri(clientUri);
}

/** The functions that complete in the REPL Inputs and resolve their candidates, for cljs-lib. */
export const completionAdapter = {
  replCompletions: (
    sessionKey: string,
    ns: string,
    doc: model.EditableDocument,
    offset: number
  ): Promise<CompletionItem[]> =>
    replCompletion.replCompletions(sessionRegistry.getSession(sessionKey), ns, doc, offset),
  lspCompletions: (uri: vscode.Uri | undefined, text: string, line: number, character: number) => {
    const client = lspClient(uri);
    const cancellation = new vscode.CancellationTokenSource();
    return {
      items: client
        ? replInputCopy.complete(client, text, { line, character }, cancellation.token)
        : Promise.resolve([]),
      cancel: () => cancellation.cancel(),
    };
  },
  mergeCompletions: (lspItems: MergeableItems, replItems: MergeableItems) =>
    completionUtil.mergeCompletions(lspItems, replItems),
  resolveReplCompletion: (sessionKey: string, ns: string, item: CompletionItem) =>
    completion.resolveReplCompletionItem(
      sessionRegistry.getSession(sessionKey),
      ns,
      item as unknown as vscode.CompletionItem
    ),
  resolveLspCompletion: (uri: vscode.Uri | undefined, item: CompletionItem) =>
    lspClient(uri)?.sendRequest(vscodeLsp.CompletionResolveRequest.type, item),
};
