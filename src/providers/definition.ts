import * as vscode from 'vscode';
import * as state from '../state';
import * as util from '../utilities';

export class DefinitionProvider implements vscode.DefinitionProvider {
  state: any;
  constructor() {
    this.state = state;
  }

  async provideDefinition(document, position, token) {
    let text = util.getWordAtPosition(document, position);
    let client = util.getSession(util.getFileType(document));
    if (util.getConnectedState()) {
      let info = await client.info(util.getNamespace(document), text);
      if (info.file && info.file.length > 0) {
        let pos = new vscode.Position(info.line - 1, info.column);
        let location = new vscode.Location(vscode.Uri.parse(info.file), pos);
        return location;
      }
    }
  }
};