import * as vscode from 'vscode';
import * as state from '../state';
import { nClient as nClient } from "../connector";
import * as util from '../utilities';

export default class HoverProvider implements vscode.HoverProvider {
    state: any;
    constructor() {
        this.state = state;
    }
    formatDocString(nsname, arglist, doc) {
        let result = '';
        if (nsname.length > 0 && nsname !== 'undefined') {
            result += '**' + nsname + '**  ';
            result += '\n';
        }

        // Format the different signatures for the fn
        if (arglist & arglist.substring) {
            result += arglist.substring(0, arglist.length)
                .replace(/\]/g, ']_')
                .replace(/\[/g, '* _[');
            result += '\n\n';
        }

        // Format the actual docstring
        if (doc) {
            result += doc.replace(/\s\s+/g, ' ');
            result += '  ';
        }
        return result.length > 0 ? result : "";
    }

    async provideHover(document, position, _) {
        let text = util.getWordAtPosition(document, position);
        if (this.state.deref().get('connected')) {
            let client = util.getSession(util.getFileType(document));
            let ns = util.getNamespace(document);
            let res = await client.info(ns, text);
            if(res.doc)
                return new vscode.Hover(this.formatDocString(res.ns+"/"+res.name, res["arglists-str"] || [], res.doc))
            if(res.ns)
                return new vscode.Hover(this.formatDocString(res.ns+"/"+res.name, res["arglists-str"] || [], "No documentation available"));
        } else
            return new vscode.Hover("Not connected to nREPL..");
    }
};
