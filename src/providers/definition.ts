import * as vscode from 'vscode';
import * as state from '../state';
import * as util from '../utilities';
import * as annotations from './annotations';
import * as namespace from '../namespace';
import * as docMirror from '../doc-mirror/index';
import * as outputWindow from '../repl-window/repl-window-doc';
import * as replSession from '../nrepl/repl-session';
import * as config from '../config';
import * as protocolConverter from 'vscode-languageclient/lib/common/protocolConverter';
import * as vscodeLanguageclient from 'vscode-languageclient';
import * as lsp from '../lsp';
import * as replDefinition from './repl-definition';
import * as cljsLib from '../../out/cljs-lib/cljs-lib';

const converter = protocolConverter.createConverter(undefined, undefined, true);

const definitionFunctions = { lsp: lspDefinition, repl: provideClojureDefinition };

/** Returns the location of a definition the REPL reports in a file, or `undefined` when its file isn't a uri. */
export function replLocation(definition: replDefinition.ReplDefinition) {
  const { line, character } = replDefinition.definitionPosition(definition);
  const pos = new vscode.Position(line, character);
  try {
    return new vscode.Location(vscode.Uri.parse(definition.file, true), pos);
  } catch (e) {
    /* ignore */
  }
}

/** Returns the definition's location in the read-only entry of the REPL Input evaluation `evaluationId` that made it. */
function replInputEvaluationDefinition(
  evaluationId: number,
  { line, column }: replDefinition.ReplDefinition
) {
  const entry = cljsLib.replInputEvaluationLocation(evaluationId, line, column);
  return entry
    ? new vscode.Location(
        vscode.Uri.parse(entry.uri),
        new vscode.Position(entry.line, entry.character)
      )
    : undefined;
}

// Resolves with nothing when the lookup is cancelled, as when a Cmd-hover moves on while
// cider-nrepl downloads a sources jar. The download carries on, for the next lookup.
function untilCancelled<T>(lookup: Promise<T>, token: vscode.CancellationToken) {
  return Promise.race([
    lookup,
    new Promise<undefined>((resolve) => token.onCancellationRequested(() => resolve(undefined))),
  ]);
}

async function provideClojureDefinition(
  clientProvider: lsp.ClientProvider,
  document,
  position: vscode.Position,
  token: vscode.CancellationToken
) {
  if (token.isCancellationRequested) {
    return;
  }
  if (util.getConnectedState()) {
    const definition = await untilCancelled(
      replDefinition.replDefinition(
        replSession.getSession(document),
        namespace.getNamespace(document, position)[0],
        docMirror.getDocument(document),
        document.offsetAt(position),
        { downloadSourcesJar: true }
      ),
      token
    );
    if (definition) {
      const evaluationId = cljsLib.replInputEvaluationId(definition.file);
      if (evaluationId) {
        return replInputEvaluationDefinition(evaluationId, definition);
      }
      const location = replLocation(definition);
      if (location && location.uri.toString() !== document.uri.toString()) {
        return location;
      }
    }
  }
}

function lspDefinition(
  clientProvider: lsp.ClientProvider,
  document,
  position: vscode.Position,
  token
) {
  const client = clientProvider.getClientForDocumentUri(document.uri);
  return client?.sendRequest(
    vscodeLanguageclient.DefinitionRequest.type,
    client?.code2ProtocolConverter.asTextDocumentPositionParams(document, position),
    token
  );
}

function asLocation(definition) {
  return definition instanceof vscode.Location ? definition : converter.asLocation(definition);
}

export class ClojureDefinitionProvider implements vscode.DefinitionProvider {
  state = state;
  constructor(private readonly clientProvider: lsp.ClientProvider) {}

  async provideDefinition(document, position: vscode.Position, token: vscode.CancellationToken) {
    const providers = config.getConfig().definitionProviderPriority;
    for (const provider of providers) {
      const providerFunction = definitionFunctions[provider];
      if (providerFunction) {
        const definition = await providerFunction(
          this.clientProvider,
          document,
          position,
          token
        )?.catch((e) => {
          console.error(
            `Definition lookup failed for provider '${provider}', ${
              provider === 'lsp'
                ? 'is clojure-lsp running and configured correctly?'
                : 'do you have the cider-nrepl dependency loaded in your project? See https://calva.io/connect'
            }`,
            e
          );
        });
        if (definition) {
          return asLocation(definition);
        }
      } else {
        void vscode.window.showErrorMessage(
          `Bad 'calva.definitionProviderPriority' setting, '${provider}' is not supported.`
        );
      }
    }
    return null;
  }
}

export class StackTraceDefinitionProvider implements vscode.DefinitionProvider {
  state: any;
  constructor() {
    this.state = state;
  }

  provideDefinition(document: vscode.TextDocument, position: vscode.Position, _token) {
    const text = document.getText(
      new vscode.Range(position.with(position.line, 0), position.with(position.line, Infinity))
    );
    const entry = outputWindow.getStacktraceEntryForKey(text);
    if (entry) {
      const pos = new vscode.Position(entry.line - 1, 0);
      return new vscode.Location(entry.uri, pos);
    }
  }
}
