import * as vscode from 'vscode';
import * as state from '../state';
import * as util from '../utilities';
import { client as nClient } from "../connector"
export default class DefinitionProvider implements vscode.DefinitionProvider {
    state: any;
    constructor() {
        this.state = state;
    }

    async provideDefinition(document, position, token) {
        let text = util.getWordAtPosition(document, position);
        if(this.state.deref().get('connected')) {
            let info = await nClient.session.info(util.getNamespace(document.getText()), text);
            if(info.file && info.file.length > 0) {
                let pos = new vscode.Position(info.line - 1, info.column);
                return new vscode.Location(vscode.Uri.parse(info.file), pos);
            }
        }
    }
};
