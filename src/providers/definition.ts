import * as vscode from 'vscode';
import * as state from '../state';
import * as util from '../utilities';
import annotations from './annotations';
import * as namespace from '../namespace';
import * as outputWindow from '../results-output/results-doc';
import * as replSession from '../nrepl/repl-session';
import { createConverter } from 'vscode-languageclient/lib/common/protocolConverter';
import { getClient } from '../lsp/main';
import { DefinitionRequest } from 'vscode-languageclient';

const converter = createConverter(undefined, undefined);

const definitionProviderOptions = { priority: ['lsp', 'repl'] };

const definitionFunctions = { lsp: lspDefinition, repl: provideClojureDefinition };

async function provideClojureDefinition(document, position: vscode.Position, _token) {
  const evalPos = annotations.getEvaluationPosition(position);
  const posIsEvalPos = evalPos && position.isEqual(evalPos);
  if (util.getConnectedState() && !posIsEvalPos) {
    const text = util.getWordAtPosition(document, position);
    const client = replSession.getSession(util.getFileType(document));
    const info = await client.info(namespace.getNamespace(document), text);
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

async function lspDefinition(document, position: vscode.Position, token) {
  const lspClient = await getClient(20);
  return lspClient.sendRequest(
    DefinitionRequest.type,
    lspClient.code2ProtocolConverter.asTextDocumentPositionParams(document, position),
    token
  );
}

export class ClojureDefinitionProvider implements vscode.DefinitionProvider {
  state: any;
  constructor() {
    this.state = state;
  }

  async provideDefinition(document, position: vscode.Position, token) {
    for (const provider of definitionProviderOptions.priority) {
      const definition = await definitionFunctions[provider](document, position, token);

      if (definition) {
        if (definition instanceof vscode.Location) {
          return definition;
        }

        return converter.asLocation(definition);
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
