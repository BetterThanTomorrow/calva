import vscode from 'vscode';
import { deref } from '../state';
import createReplClient from '../repl/client';
import message from 'goog:calva.repl.message';
import { getNamespace, getWordAtPosition } from '../utilities';

function formatDocString(nsname, arglist, doc) {
    let result = '';
    if (nsname.length > 0 && nsname !== 'undefined') {
        result += '**' + nsname + '**  ';
        result += '\n';
    }

    // Format the different signatures for the fn
    if (arglist !== 'undefined') {
        result += arglist.substring(0, arglist.length)
            .replace(/\]/g, ']_')
            .replace(/\[/g, '* _[');
        result += '\n\n';
    }

    // Format the actual docstring
    if (doc !== 'undefined') {
        result += doc.replace(/\s\s+/g, ' ');
        result += '  ';
    }
    return result.length > 0 ? result : "";
}

export default class HoverProvider {

    provideHover(document, position, _) {
        let text = getWordAtPosition(document, position),
            docstring = "",
            arglist = "",
            nsname = "",
            filetypeIndex = (document.fileName.lastIndexOf('.') + 1),
            filetype = document.fileName.substr(filetypeIndex, document.fileName.length);

        if (text.length <= 0) {
            return;
        }

        if (deref().get('connected')) {
            return new Promise((resolve, reject) => {
                let current = deref(),
                    client = createReplClient()
                        .once('connect', () => {
                            let msg = message.infoMsg(current.get(filetype),
                                getNamespace(document.getText()), text);
                            client.send(msg, function (results) {
                                if (results.length === 1 &&
                                    results[0].status[0] === "done" &&
                                    results[0].status[1] === "no-info") {
                                    reject("No docstring available..");
                                }

                                for (var r = 0; r < results.length; r++) {
                                    let result = results[r];
                                    docstring += result.doc;
                                    arglist += result['arglists-str'];
                                    if (result.hasOwnProperty('ns') &&
                                        result.hasOwnProperty('name')) {
                                        nsname = result.ns + "/" + result.name;
                                    }
                                }
                                if (docstring.length === 0) {
                                    reject("Docstring error: " + text);
                                } else {
                                    const result = formatDocString(nsname, arglist, docstring);
                                    if (result.length === 0) {
                                        reject("Docstring error: " + text);
                                    } else {
                                        resolve(new vscode.Hover(result));
                                    }
                                }
                                client.end();
                            });
                        });
            });
        } else {
            return new vscode.Hover("Not connected to nREPL..");
        }
    }
};
