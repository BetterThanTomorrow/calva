import * as vscode from 'vscode';
import * as state from '../state';
import repl from '../repl/client';
import * as util from '../utilities';

import * as calvaLib from '../../lib/calva';


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

    provideHover(document, position, _) {
        let text = util.getWordAtPosition(document, position),
            docstring = "",
            arglist = "",
            nsname = "",
            scope = this,
            filetypeIndex = (document.fileName.lastIndexOf('.') + 1),
            filetype = document.fileName.substr(filetypeIndex, document.fileName.length);

        if (text.length <= 0) {
            return;
        }

        if (this.state.deref().get('connected')) {
            return new Promise<vscode.Hover>((resolve, reject) => {
                let current = this.state.deref(),
                    client = calvaLib.nrepl_create(repl.getDefaultOptions())
                        .once('connect', () => {
                            let msg = calvaLib.message_infoMsg(current.get(filetype),
                                util.getNamespace(document.getText()), text);
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
                                    let result = scope.formatDocString(nsname, arglist, docstring);
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
