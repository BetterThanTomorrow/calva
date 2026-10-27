import * as vscode from 'vscode';
import * as cljsLib from '../out/cljs-lib/cljs-lib';
import * as config from './config';
import type * as model from './cursor-doc/model';
import * as replInputCopy from './lsp/repl-input-copy';
import * as sessionRegistry from './nrepl/session-registry';
import * as definitionProvider from './providers/definition';
import * as replDefinition from './providers/repl-definition';
import { lspClient } from './repl-input-completion';

/** The scheme of the read-only editors that show what a REPL Input evaluated. */
export const evaluationScheme: string = cljsLib.replInputEvaluationScheme;

function openAt(uri: vscode.Uri, position: vscode.Position) {
  return vscode.window.showTextDocument(uri, { selection: new vscode.Range(position, position) });
}

/** The functions that find definitions for the REPL Inputs and open them, for cljs-lib. */
export const definitionAdapter = {
  definitionPriority: (): string[] => config.getConfig().definitionProviderPriority,
  replDefinition: (sessionKey: string, ns: string, doc: model.EditableDocument, offset: number) =>
    replDefinition.replDefinition(sessionRegistry.getSession(sessionKey), ns, doc, offset, {
      downloadSourcesJar: true,
    }),
  lspDefinition: (uri: vscode.Uri | undefined, text: string, line: number, character: number) => {
    const client = lspClient(uri);
    return client
      ? replInputCopy.definition(
          client,
          text,
          { line, character },
          new vscode.CancellationTokenSource().token
        )
      : Promise.resolve(undefined);
  },
  openReplDefinition: (definition: replDefinition.ReplDefinition) => {
    const location = definitionProvider.replLocation(definition);
    return location && openAt(location.uri, location.range.start);
  },
  openLocation: (uri: string, line: number, character: number) =>
    openAt(vscode.Uri.parse(uri), new vscode.Position(line, character)),
};

export function register() {
  return [
    vscode.workspace.registerTextDocumentContentProvider(evaluationScheme, {
      provideTextDocumentContent: (uri) => cljsLib.replInputEvaluationCode(uri.path),
    }),
    vscode.commands.registerCommand('calva.replInput.revealDefinition', () =>
      cljsLib.replInputRevealDefinitionFocused()
    ),
  ];
}
