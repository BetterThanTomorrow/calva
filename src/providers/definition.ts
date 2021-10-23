import * as vscode from 'vscode';
import * as state from '../state';
import * as util from '../utilities';
import annotations from './annotations';
import * as namespace from '../namespace';
import * as outputWindow from '../results-output/results-doc';
import * as replSession from '../nrepl/repl-session';

// Used by out LSP middleware
export async function provideClojureDefinition(document, position: vscode.Position, _token) {
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
      } catch(e) { /* ignore */ }
    }
  }
}

// TODO: This provider is no longer used. We should factor the code away such that
//       it is clearer that this is handled by our LSP middleware.
export class ClojureDefinitionProvider implements vscode.DefinitionProvider {
  state: any;
  constructor() {
    this.state = state;
  }

  async provideDefinition(document, position: vscode.Position, token) {
    return await provideClojureDefinition(document, position, token);
  }
}

export class StackTraceDefinitionProvider implements vscode.DefinitionProvider {
  state: any;
  constructor() {
    this.state = state;
  }

  async provideDefinition(document: vscode.TextDocument, position: vscode.Position, _token) {
    const text = document.getText(new vscode.Range(position.with(position.line, 0), position.with(position.line, Infinity)));
    const entry = outputWindow.getStacktraceEntryForKey(text);
    if (entry) {
      const pos = new vscode.Position(entry.line - 1, 0);
      return new vscode.Location(entry.uri, pos);
    }
  }
}