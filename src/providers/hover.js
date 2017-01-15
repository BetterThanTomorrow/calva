const vscode = require('vscode');
const nreplClient = require('../nrepl/client');
const nreplMsg = require('../nrepl/message');
const helpers = require('../clojure/helpers');

module.exports = class HoverProvider {
    constructor(state) {
        this.state = state;
        this.specialWords = ['-', '+', '/', '*']; //TODO: Add more here
    }

    formatDocString(arglist, doc) {
        let result = '';
        if (arglist !== 'undefined') {
            result += '**signature:**\n\n'
            result += arglist.substring(1, arglist.length - 1)
                .replace(/\]\ \[/g, ']\n\n[');
        }
        if (doc !== 'undefined') {
            result += '\n\n**description:**\n\n'
            result += '```clojure\n' + doc.replace(/\s\s+/g, ' ') + '\n```';
        }
        result += '';
        return result.length > 0 ? result : "";
    }

    provideHover(document, position, token) {
        let selected = document.getWordRangeAtPosition(position),
            selectedText = selected !== undefined ? document.getText(new vscode.Range(selected.start, selected.end)) : "",
            text = helpers.getActualWord(document, position, selected, selectedText),
            arglist = "",
            docstring = "",
            scope = this;
        if (this.state.connected) {
            return new Promise((resolve, reject) => {
                let infoClient = nreplClient.create({
                    host: scope.state.hostname,
                    port: scope.state.port
                }).once('connect', () => {
                    let msg = nreplMsg.info(scope.state, helpers.getNamespace(document.getText()), text);
                    infoClient.send(msg, function (results) {
                        for (var r = 0; r < results.length; r++) {
                            let result = results[r];

                            arglist += result['arglists-str'];
                            docstring += result.doc;
                        }
                        infoClient.end();
                        if (docstring.length === 0) {
                            reject("Docstring not found for " + text);
                        } else {
                            let result = scope.formatDocString(arglist, docstring);
                            if (result.length === 0) {
                                reject("Docstring not found for " + text);
                            } else {
                                resolve(new vscode.Hover(result));
                            }
                        }
                    });
                });
            });
        } else {
            return new vscode.Hover("Not connected to nREPL..");
        }
    }
}
