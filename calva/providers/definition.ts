import * as vscode from 'vscode';
import * as state from '../state';
import * as util from '../utilities';
import repl from '../repl/client';
import * as calvaLib from '../../lib/calva';


export default class DefinitionProvider implements vscode.DefinitionProvider {
    state: any;
    constructor() {
        this.state = state;
    }

    provideDefinition(document, position, token) {
        let text = util.getWordAtPosition(document, position),
            location = null,
            scope = this,
            filetypeIndex = (document.fileName.lastIndexOf('.') + 1),
            filetype = document.fileName.substr(filetypeIndex, document.fileName.length);
        return new Promise<vscode.Location>((resolve, reject) => {
            if (this.state.deref().get('connected')) {
                let current = scope.state.deref(),
                    client = calvaLib.nrepl_create(repl.getDefaultOptions()).once('connect', () => {
                        let msg = calvaLib.message_infoMsg(util.getSession(filetype),
                            util.getNamespace(document.getText()), text);
                        client.send(msg, function (results) {
                            for (var r = 0; r < results.length; r++) {
                                let result = results[r];
                                if (result.hasOwnProperty('file') && result.file.length > 0) {
                                    let pos = new vscode.Position(result.line - 1, result.column);
                                    location = new vscode.Location(vscode.Uri.parse(result.file), pos);
                                }
                            }
                            if (location !== null) {
                                resolve(location);
                            } else {
                                reject("No definition found");
                            }
                            client.end();
                        });
                    });
            } else {
                reject("Not connected to a REPL…");
            }
        });
    }
};
