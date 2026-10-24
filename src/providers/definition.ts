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

/** What a provider returns when it has revealed the definition in an Output view, and VS Code has nothing to open. */
const revealedInOutputView = Symbol('revealedInOutputView');

/** Returns the location of a definition the REPL reports in a file, or `undefined` when its file isn't a uri. */
export function replLocation(definition: replDefinition.ReplDefinition) {
  const pos = new vscode.Position(definition.line - 1, definition.column || 0);
  try {
    return new vscode.Location(vscode.Uri.parse(definition.file, true), pos);
  } catch (e) {
    /* ignore */
  }
}

// Go to definition asks with the cursor's position; hovering with the modifier asks with the mouse's
function isAtCursor(document: vscode.TextDocument, position: vscode.Position) {
  const editor = vscode.window.activeTextEditor;
  return editor?.document === document && editor.selection.active.isEqual(position);
}

/**
 * Reveals the code block of the REPL Input evaluation `evaluationId` that made the definition, when
 * going to it, or returns the definition's location in the evaluation's read-only history entry.
 */
async function replInputEvaluationDefinition(
  document: vscode.TextDocument,
  position: vscode.Position,
  evaluationId: number,
  { line, column }: replDefinition.ReplDefinition
) {
  if (
    isAtCursor(document, position) &&
    (await cljsLib.replInputRevealEvaluation(evaluationId, line, column))
  ) {
    return revealedInOutputView;
  }
  const entry = cljsLib.replInputEvaluationLocation(evaluationId, line, column);
  return entry
    ? new vscode.Location(
        vscode.Uri.parse(entry.uri),
        new vscode.Position(entry.line, entry.character)
      )
    : undefined;
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
    const definition = await replDefinition.replDefinition(
      replSession.getSession(),
      namespace.getNamespace(document, position)[0],
      docMirror.getDocument(document),
      document.offsetAt(position)
    );
    if (definition) {
      const evaluationId = cljsLib.replInputEvaluationId(definition.file);
      if (evaluationId) {
        return replInputEvaluationDefinition(document, position, evaluationId, definition);
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
  if (definition === revealedInOutputView) {
    return null;
  }
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
