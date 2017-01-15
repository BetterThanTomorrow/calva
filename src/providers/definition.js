const vscode = require('vscode');
const nreplClient = require('../nrepl/client');
const nreplMsg = require('../nrepl/message');
const helpers = require('../clojure/helpers');

module.exports = class DefinitionProvider {
    constructor(state) {
        this.state = state;
        this.specialWords = ['-', '+', '/', '*']; //TODO: Add more here
    }

    provideDefinition(document, position, token) {
        let selected = document.getWordRangeAtPosition(position),
            selectedText = selected !== undefined ? document.getText(new vscode.Range(selected.start, selected.end)) : "",
            text = helpers.getActualWord(document, position, selected, selectedText),
            location = null,
            scope = this;
        if (this.state.connected) {
            return new Promise((resolve, reject) => {
                let defClient = nreplClient.create({
                    host: scope.state.hostname,
                    port: scope.state.port
                }).once('connect', () => {
                    let msg = nreplMsg.info(scope.state, helpers.getNamespace(document.getText()), text);
                    defClient.send(msg, function (results) {
                        for (var r = 0; r < results.length; r++) {
                            let result = results[r];
                            if (result.hasOwnProperty('file') && result.file.length > 0) {
                                location = new vscode.Location(vscode.Uri.parse(result.file),
                                    new vscode.Position(result.line - 1, result.column));
                            }
                        }
                        if (location !== null) {
                            resolve(location);
                        } else {
                            reject("No definition found");
                        }
                        defClient.end();
                    });
                });
            });
        } else {
            return new vscode.Hover("Not connected to nREPL..");
        }
    }
};
