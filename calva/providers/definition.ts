import * as vscode from 'vscode';
import * as state from '../state';
import * as util from '../utilities';
import repl from '../repl/client';
const nreplClient = require('@cospaia/calva-lib/lib/calva.repl.client');
const nreplMessage = require('@cospaia/calva-lib/lib/calva.repl.message');

export default class DefinitionProvider implements vscode.DefinitionProvider {
    state: any;
    constructor() {
        this.state = state;
    }

    provideDefinition(document, position, token) {
        let client = state.deref().get('nrepl-client'),
            text = util.getWordAtPosition(document, position),
            location = null,
            scope = this,
            filetypeIndex = (document.fileName.lastIndexOf('.') + 1),
            filetype = document.fileName.substr(filetypeIndex, document.fileName.length);
        return new Promise<vscode.Location>((resolve, reject) => {
            if (this.state.deref().get('connected')) {
                let current = scope.state.deref(),
                    msg = nreplMessage.infoMsg(util.getSession(filetype),
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
                });
            } else {
                reject("Not connected to a REPL…");
            }
        });
    }
};
