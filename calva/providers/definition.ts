import * as vscode from 'vscode';
import * as state from '../state';
import * as util from '../utilities';
import { wslToWindows } from 'wsl-path';

export class DefinitionProvider implements vscode.DefinitionProvider {
    state: any;
    constructor() {
        this.state = state;
    }

    async provideDefinition(document, position, token) {
        let text = util.getWordAtPosition(document, position);
        let client = util.getSession(util.getFileType(document));
        if(this.state.deref().get('connected')) {
            let info = await client.info(util.getNamespace(document.getText()), text);
            if(info.file && info.file.length > 0) {
                let pos = new vscode.Position(info.line - 1, info.column);
                return new vscode.Location(vscode.Uri.parse(info.file), pos);
            }
        }
    }
};

export class WslDefinitionProvider extends DefinitionProvider {
  async provideDefinition(document, position, token) {
    const location = await super.provideDefinition(document, position, token);
    if (!location) return;
    
    const windowsFilePath = await wslToWindows(location.uri.path);
    return new vscode.Location(vscode.Uri.file(windowsFilePath), location.range);
  }
} 