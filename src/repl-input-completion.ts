import * as vscode from 'vscode';
import type { CompletionItem } from 'vscode-languageserver-protocol';
import type * as model from './cursor-doc/model';
import * as sessionRegistry from './nrepl/session-registry';
import * as completion from './providers/completion';
import * as replCompletion from './providers/repl-completion';

/** The functions that complete in the REPL Inputs and resolve their candidates, for cljs-lib. */
export const completionAdapter = {
  replCompletions: (
    sessionKey: string,
    ns: string,
    doc: model.EditableDocument,
    offset: number
  ): Promise<CompletionItem[]> =>
    replCompletion.replCompletions(sessionRegistry.getSession(sessionKey), ns, doc, offset),
  resolveReplCompletion: (sessionKey: string, ns: string, item: CompletionItem) =>
    completion.resolveReplCompletionItem(
      sessionRegistry.getSession(sessionKey),
      ns,
      item as unknown as vscode.CompletionItem
    ),
};
