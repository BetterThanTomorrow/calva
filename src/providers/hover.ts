import * as vscode from 'vscode';
import * as state from '../state';
import * as util from '../utilities';
import * as infoparser from './infoparser';
import * as namespace from '../namespace';

export default class HoverProvider implements vscode.HoverProvider {
    state: any;

    constructor() {
        this.state = state;
    }

    async provideHover(document, position, _) {

        if (util.getConnectedState()) {
            let text = util.getWordAtPosition(document, position);
            let ns = namespace.getNamespace(document);
            let client = namespace.getSession(util.getFileType(document));
            if(client) {
                await namespace.createNamespaceFromDocumentIfNotExists(document);
                let res = await client.info(ns, text);
                return new vscode.Hover(infoparser.getHover(res));
            }
            return new vscode.Hover(infoparser.getHoverNotAvailable(text));
        }
    }
};
