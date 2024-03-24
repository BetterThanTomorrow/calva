import * as vscode from 'vscode';
import * as state from '../state';
import * as util from '../utilities';
import annotations from './annotations';
import * as namespace from '../namespace';
import * as outputWindow from '../repl-window/repl-doc';
import * as replSession from '../nrepl/repl-session';
import * as config from '../config';
import { createConverter } from 'vscode-languageclient/lib/common/protocolConverter';
import { DefinitionRequest } from 'vscode-languageclient';
import * as lsp from '../lsp';

const converter = createConverter(undefined, undefined, true);

const definitionFunctions = { lsp: lspDefinition, repl: provideClojureDefinition };

async function provideClojureDefinition(
  clientProvider: lsp.ClientProvider,
  document,
  position: vscode.Position,
  _token
) {
  if (util.getConnectedState()) {
    const client = replSession.getSession(util.getFileType(document));
    if (client?.supports('info')) {
      const text = util.getWordAtPosition(document, position);
      const info = await client.info(namespace.getNamespace(document, position)[0], text);
      if (info.file && info.file.length > 0) {
        const pos = new vscode.Position(info.line - 1, info.column || 0);
        try {
          return new vscode.Location(vscode.Uri.parse(info.file, true), pos);
        } catch (e) {
          /* ignore */
        }
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
    DefinitionRequest.type,
    client?.code2ProtocolConverter.asTextDocumentPositionParams(document, position),
    token
  );
}

export class ClojureDefinitionProvider implements vscode.DefinitionProvider {
  state = state;
  constructor(private readonly clientProvider: lsp.ClientProvider) {}

  async provideDefinition(document, position: vscode.Position, token) {
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
          if (definition instanceof vscode.Location) {
            return definition;
          }
          return converter.asLocation(definition);
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
