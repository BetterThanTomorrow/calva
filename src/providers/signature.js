const vscode = require('vscode');
const state = require('../state');

const repl = require('../repl/client');
const message = require('../repl/message');
const {getNamespace, getActualWord} = require('../utilities');

module.exports = class SignatureProvider {
    constructor() {
        this.state = state;
    }

    provideSignatureHelp(document, position, token) {
        let selected = document.getWordRangeAtPosition(position),
            selectedText = selected !== undefined ? document.getText(new vscode.Range(selected.start, selected.end)) : "",
            text = getActualWord(document, position, selected, selectedText),
            arglist = [],
            scope = this,
            filetypeIndex = (document.fileName.lastIndexOf('.') + 1),
            filetype = document.fileName.substr(filetypeIndex, document.fileName.length);
        if (this.state.deref().get('connected')) {
            return new Promise((resolve, reject) => {
                let current = scope.state.deref(),
                    client = repl.create().once('connect', () => {
                    let msg = message.info(current.get(filetype),
                                           getNamespace(document.getText()), text);
                    client.send(msg, function (results) {
                        for (var r = 0; r < results.length; r++) {
                            let result = results[r];
                            if (result.hasOwnProperty('arglits-str')) {
                                arglist.push(result['arglists-str']);
                            }
                        }
                        client.end();
                        if (arglist.length === 0) {
                            reject("Signature not found for " + text);
                        } else {
                            let result = arglist;
                            if (result.length === 0) {
                                reject("Signature not found for " + text);
                            } else {
                                let sh = new vscode.SignatureHelp();
                                let si = [];
                                for(var i = 0; i < arglist.length; i++) {
                                    si.push(new vscode.SignatureInformation("Label", arglist[i]));
                                }
                                sh.signatures = si;
                                resolve(sh);
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
