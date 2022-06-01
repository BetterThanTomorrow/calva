import * as vscode from 'vscode';
import lsp from '../lsp/main';
import * as util from '../utilities';

export class CalvaDocumentSymbolsProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.SymbolInformation[] | vscode.DocumentSymbol[]> {
    return lsp.getDocumentSymbols(util.cljsLib.getStateValue(lsp.LSP_CLIENT_KEY), document.uri);
  }
}
