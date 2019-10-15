import * as vscode from 'vscode';
import * as state from '../state';
import * as util from '../utilities';
import * as projectTypes from '../nrepl/project-types';
import { wslToWindows } from 'wsl-path';

export class DefinitionProvider implements vscode.DefinitionProvider {
  state: any;
  constructor() {
    this.state = state;
  }

  async provideDefinition(document, position, token) {
    let { useWSL } = state.config();
    let text = util.getWordAtPosition(document, position);
    let client = util.getSession(util.getFileType(document));
    if (util.getConnectedState()) {
      let info = await client.info(util.getNamespace(document), text);
      if (info.file && info.file.length > 0) {
        let pos = new vscode.Position(info.line - 1, info.column);
        let location = new vscode.Location(vscode.Uri.parse(info.file), pos);
        if (!location) {
          return;
        }
        if (projectTypes.isWin && useWSL) {
          if (location.uri.scheme === 'jar') {
            const path = vscode.Uri.parse(location.uri.path).path;
            const windowsFilePath = await wslToWindows(path);
            const windowsFileUri = vscode.Uri.file(windowsFilePath);
            return new vscode.Location(location.uri.with({ path: `file:${windowsFileUri.path}` }), location.range);
          }
          const windowsFilePath = await wslToWindows(location.uri.path);
          return new vscode.Location(vscode.Uri.file(windowsFilePath), location.range);
        } else {
          return location;
        }
      }
    }
  }
};