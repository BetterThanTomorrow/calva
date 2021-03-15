import * as vscode from 'vscode';
import * as state from '../state';
import annotations from './annotations';
import * as outputWindow from '../results-output/results-doc';

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

export class ResultsDefinitionProvider implements vscode.DefinitionProvider {
  state: any;
  constructor() {
    this.state = state;
  }
  async provideDefinition(document, position, token) {
    return annotations.getResultsLocation(position);
  }
}
