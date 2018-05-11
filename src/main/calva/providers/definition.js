import vscode from 'vscode';
import * as state from '../state';
import repl from '../repl/client';
import message from 'goog:calva.repl.message';
import * as util from '../utilities';

export default class DefinitionProvider {
    constructor() {
        this.state = state;
    }

    provideDefinition(document, position, token) {
        let text = util.getWordAtPosition(document, position),
            location = null,
            scope = this,
            filetypeIndex = (document.fileName.lastIndexOf('.') + 1),
            filetype = document.fileName.substr(filetypeIndex, document.fileName.length);
        if (this.state.deref().get('connected')) {
            return new Promise((resolve, reject) => {
                let current = scope.state.deref(),
                    client = repl.create().once('connect', () => {
                        let msg = message.infoMsg(util.getSession(filetype),
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
            });
        } else {
            return new vscode.Hover("Not connected to nREPL..");
        }
    }
};
