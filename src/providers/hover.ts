import * as vscode from 'vscode';
import * as state from '../state';
import * as util from '../utilities';
import * as infoparser from './infoparser';
import * as namespace from '../namespace';
import * as replSession from '../nrepl/repl-session';
import { updateInfoPanel } from '../info-panel/web-view';

export default class HoverProvider implements vscode.HoverProvider {
    state: any;

    constructor() {
        this.state = state;
    }

    async provideHover(document, position, _) {

        if (util.getConnectedState()) {
            let text = util.getWordAtPosition(document, position);
            let ns = namespace.getNamespace(document);
            let client = replSession.getSession(util.getFileType(document));
            if(client) {
                await namespace.createNamespaceFromDocumentIfNotExists(document);
                const res = await client.info(ns, text);
                const info = infoparser.getHover(res)

                updateInfoPanel({type: "UpdateContent", content: info})

                return new vscode.Hover(info);
            }
            return new vscode.Hover(infoparser.getHoverNotAvailable(text));
        }
    }
};
