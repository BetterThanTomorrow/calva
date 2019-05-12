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
      return items.filter(({ file }) => file && file.length > 0)
        .map(({ name, ns, file, line, column }, index) => new vscode.SymbolInformation(
          name,
          typeToKind[vars[index].type] || vscode.SymbolKind.Variable,
          ns,
          new vscode.Location(vscode.Uri.parse(file),
            new vscode.Position(line - 1, column)))
      );
    }
  }
}
