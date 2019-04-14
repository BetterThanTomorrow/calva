import * as vscode from 'vscode';
import * as state from '../state';
import * as util from '../utilities';

const typeToKind = {
  "function": vscode.SymbolKind.Function,
  "variable": vscode.SymbolKind.Variable,
  // NOTE(alexk) There is no SymbolKind for Macro, so I chose one with the icon I liked.
  "macro": vscode.SymbolKind.Field,
};

export class DocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  state: any;
  constructor() {
    this.state = state;
  }

  public async provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.SymbolInformation[]> {
    if (this.state.deref().get('connected')) {
      let client = util.getSession(util.getFileType(document));
      const ns = util.getNamespace(document.getText());
      const aproposResponse = await client.apropos({
        "private?": true,
        "ns-query": { "exactly": [ns] }
      });
      const vars = aproposResponse["apropos-matches"];
      const items = await Promise.all(vars.map((v: any) => client.info(ns, v.name.split("/")[1])));
      return items.map((info: any, index) => new vscode.SymbolInformation(
        info.name,
        typeToKind[vars[index].type] || vscode.SymbolKind.Variable,
        info.ns,
        info.file && info.file.length > 0 && new vscode.Location(vscode.Uri.parse(info.file),
          new vscode.Position(info.line - 1, info.column)))
      );
    }
  }
}
