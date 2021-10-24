import * as vscode from 'vscode';
import * as util from '../utilities';
import * as infoparser from './infoparser';
import * as namespace from '../namespace';
import * as replSession from '../nrepl/repl-session';
import * as clojureDocs from '../clojuredocs';

export async function provideHover(document, position) {
    if (util.getConnectedState()) {
        let text = util.getWordAtPosition(document, position);
        let ns = namespace.getNamespace(document);
        let client = replSession.getSession(util.getFileType(document));
        if(client) {
            await namespace.createNamespaceFromDocumentIfNotExists(document);
            let res = await client.info(ns, text);
            if (!res.status.includes('error')) {
                const docsMd = infoparser.getHover(res);
                const clojureDocsMd = await clojureDocs.getExamplesHover(document, position);
                return new vscode.Hover([docsMd, clojureDocsMd]);
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
