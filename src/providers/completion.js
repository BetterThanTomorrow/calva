const vscode = require('vscode');
const nreplClient = require('../nrepl/client');
const nreplMsg = require('../nrepl/message');
const helpers = require('../clojure/helpers');

module.exports = class CompletionItemProvider {
    constructor(state) {
        this.state = state;
        this.specialWords = ['-', '+', '/', '*']; //TODO: Add more here
        this.mappings = {
            'nil': vscode.CompletionItemKind.Value,
            'macro': vscode.CompletionItemKind.Value,
            'class': vscode.CompletionItemKind.Class,
            'keyword': vscode.CompletionItemKind.Keyword,
            'namespace': vscode.CompletionItemKind.Module,
            'function': vscode.CompletionItemKind.Function,
            'special-form': vscode.CompletionItemKind.Keyword,
            'var': vscode.CompletionItemKind.Variable,
            'method': vscode.CompletionItemKind.Method
        };
    }

    provideCompletionItems(document, position, token) {
        let selected = document.getWordRangeAtPosition(position),
            selectedText = selected !== undefined ? document.getText(new vscode.Range(selected.start, selected.end)) : "",
            text = helpers.getActualWord(document, position, selected, selectedText),
            scope = this,
            filetypeIndex = (document.fileName.lastIndexOf('.') + 1),
            filetype = document.fileName.substr(filetypeIndex, document.fileName.length);
        if (this.state.connected) {
            return new Promise((resolve, reject) => {
                let completionClient = nreplClient.create({
                    host: scope.state.hostname,
                    port: scope.state.port
                }).once('connect', () => {
                    let msg = nreplMsg.complete(scope.state.session[filetype], helpers.getNamespace(document.getText()), text),
                        completions = [];
                    completionClient.send(msg, function (results) {
                        for (var r = 0; r < results.length; r++) {
                            let result = results[r];
                            if (result.hasOwnProperty('completions')) {
                                for (let c = 0; c < result.completions.length; c++) {
                                    let item = result.completions[c];
                                    completions.push({
                                        label: item.candidate,
                                        kind: scope.mappings[item.type] || vscode.CompletionItemKind.Text,
                                        insertText: item[0] === '.' ? item.slice(1) : item
                                    });
                                }
                            }
                        }
                        if (completions.length > 0) {
                            resolve(new vscode.CompletionList(completions, false));
                        } else {
                            reject("No completions found");
                        }
                        completionClient.end();
                    });
                });
            });
        } else {
            return new vscode.Hover("Not connected to nREPL..");
        }
    }

    resolveCompletionItem(item, token) {
        let scope = this,
                editor = vscode.window.activeTextEditor,
                filetypeIndex = (editor.document.fileName.lastIndexOf('.') + 1),
                filetype = editor.document.fileName.substr(filetypeIndex, editor.document.fileName.length);
        return new Promise((resolve, reject) => {
            if (scope.state.connected) {
                let completionClient = nreplClient.create({
                    host: scope.state.hostname,
                    port: scope.state.port
                }).once('connect', () => {
                    let document = vscode.window.activeTextEditor.document,
                        msg = nreplMsg.info(scope.state.session[filetype], helpers.getNamespace(document.getText()), item.label);
                    completionClient.send(msg, function (results) {
                        for (var r = 0; r < results.length; r++) {
                            let result = results[r];
                            if (result.hasOwnProperty('doc')) {
                                item.documentation = result.doc;
                            }
                        }
                        resolve(item);
                        completionClient.end();
                    })
                })
            } else {
                reject("Not connected to nREPL");
            }
        });
    }
};
