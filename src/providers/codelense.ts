import * as vscode from 'vscode';
import * as outputWindow from '../repl-window/repl-doc';

/**
 * CodelensProvider
 */
export class PrintStackTraceCodelensProvider implements vscode.CodeLensProvider {
  private codeLenses: vscode.CodeLens[] = [];
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  constructor() {
    vscode.workspace.onDidChangeConfiguration((_) => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    if (outputWindow.isResultsDoc(document)) {
      this.codeLenses = [];
      const stackTraceRange = outputWindow.getLastStackTraceRange();
      if (stackTraceRange) {
        this.codeLenses.push(new vscode.CodeLens(stackTraceRange));
      }
      return this.codeLenses;
    }
    return [];
  }

  public resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken) {
    codeLens.command = {
      title: 'Print stacktrace',
      tooltip: 'Print the stacktrace for this error (also available from the command palette)',
      command: 'calva.printLastStacktrace',
      arguments: [],
    };
    return codeLens;
  }
}
