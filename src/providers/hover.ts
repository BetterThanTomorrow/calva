import * as vscode from 'vscode';
import * as util from '../utilities';
import * as infoparser from './infoparser';
import * as namespace from '../namespace';
import * as replSession from '../nrepl/repl-session';

export async function provideHover(document, position) {
    if (util.getConnectedState()) {
        let text = util.getWordAtPosition(document, position);
        let ns = namespace.getNamespace(document);
        let client = replSession.getSession(util.getFileType(document));
        if(client) {
            await namespace.createNamespaceFromDocumentIfNotExists(document);
            let res = await client.info(ns, text);
            if (!res.status.includes('error')) {
                return new vscode.Hover(infoparser.getHover(res));
            }
        }
        return null; //new vscode.Hover(infoparser.getHoverNotAvailable(text));
    }
}


export default class HoverProvider implements vscode.HoverProvider {
    async provideHover(document, position, _) {
        return provideHover(document, position);
    }
};
