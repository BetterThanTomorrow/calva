import * as vscode from 'vscode';
import * as state from '../state';
import * as util from '../utilities';

export class DocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  state: any;
  constructor() {
    this.state = state;
  }

  public async provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.SymbolInformation[]> {
    if (this.state.deref().get('connected')) {
      let client = util.getSession(util.getFileType(document));
      const ns = util.getNamespace(document.getText());
      const vars = await client.nsVars(ns);
      const items = await Promise.all(vars["ns-vars"].map((v: any) => {
        return client.info(ns, v);
      }));
      return items.map((info: any) => new vscode.SymbolInformation(
        info.name,
        vscode.SymbolKind.Variable,
        info.ns,
        new vscode.Location(vscode.Uri.parse(info.file),
          new vscode.Position(info.line - 1, info.column)))
      );
    }
  }
}
