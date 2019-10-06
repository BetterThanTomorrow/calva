import * as vscode from 'vscode';
import * as state from '../state';
import * as util from '../utilities';

export default class HoverProvider implements vscode.HoverProvider {
    state: any;

    constructor() {
        this.state = state;
    }

    formatDocString(nsname: string, arglist: string, documentation: string) {

        let result = '';
        // Format the namespace.
        if (nsname.length > 0 && nsname !== 'undefined') {
            result += '**' + nsname + '**  ';
            result += '\n';
        }
        // Format the different signatures for the fn
        if (arglist && arglist != "") {
            result += arglist.substring(0, arglist.length)
                .replace(/\]/g, ']')
                .replace(/\[/g, '* [');
            result += '\n\n';
            result += '\n\n';
        }
        // Format the actual docstring
        if (documentation && documentation != "") {
            result += documentation.replace(/\s\s+/g, ' ');
            result += '  ';
        }
        return result.length > 0 ? result : "";
    }

    async provideHover(document, position, _) {

        if (util.getConnectedState()) {
            let text = util.getWordAtPosition(document, position);
            let ns = util.getNamespace(document);
            let client = util.getSession(util.getFileType(document));
            if(client) {
                await util.CreateNamespaceFromDocumentIfNotExists(document);
                let res = await client.info(ns, text);
                if (res.ns && res.doc) {
                    return new vscode.Hover(this.formatDocString(res.ns + "/" + res.name, res["arglists-str"] || [], res.doc))
                }
                if (res.ns) {
                    return new vscode.Hover(this.formatDocString(res.ns + "/" + res.name, res["arglists-str"] || [], "No documentation available"));
                }
            }
            return new vscode.Hover(this.formatDocString(text, "", "No information available"));
        } else {
            return new vscode.Hover("Please connect to a REPL to retrieve information.");
        }
    }
};
