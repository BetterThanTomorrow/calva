import * as vscode from 'vscode';
import * as state from '../state';
import * as util from '../utilities';

export class DefinitionProvider implements vscode.DefinitionProvider {
  state: any;
  constructor() {
    this.state = state;
  }

  async provideDefinition(document, position, token) {
    if (util.getConnectedState()) {
      const text = util.getWordAtPosition(document, position),
         client = util.getSession(util.getFileType(document)),
         info = await client.info(util.getNamespace(document), text);
      if (info.file && info.file.length > 0) {
        const pos = new vscode.Position(info.line - 1, info.column);
        return new vscode.Location(vscode.Uri.parse(info.file), pos);
      }
    }
  }
};