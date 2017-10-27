const vscode = require('vscode');
const state = require('../state');

const repl = require('../repl/client');
const message = require('../repl/message');
const {getNamespace, getActualWord} = require('../utilities');

module.exports = class CompletionItemProvider {
    constructor() {
        this.state = state;
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
            text = getActualWord(document, position, selected, selectedText),
            scope = this,
            filetypeIndex = (document.fileName.lastIndexOf('.') + 1),
            filetype = document.fileName.substr(filetypeIndex, document.fileName.length);
        if (this.state.deref().get("connected")) {
            return new Promise((resolve, reject) => {
                let current = this.state.deref(),
                    client = repl.create()
                .once('connect', () => {
                    let msg = message.complete(current.get(filetype),
                                               getNamespace(document.getText()), text),
                        completions = [];
                    client.send(msg, function (results) {
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
                        client.end();
                    });
                });
            });
        } else {
            return new vscode.Hover("Connect to repl for auto-complete..");
        }
    }

    resolveCompletionItem(item, token) {
        let scope = this,
            editor = vscode.window.activeTextEditor,
            filetypeIndex = (editor.document.fileName.lastIndexOf('.') + 1),
            filetype = editor.document.fileName.substr(filetypeIndex, editor.document.fileName.length);
        return new Promise((resolve, reject) => {
            let current = this.state.deref();
            if (current.get('connected')) {
                let client = repl.create().once('connect', () => {
                    let document = vscode.window.activeTextEditor.document,
                        msg = message.info(current.get(filetype),
                                           getNamespace(document.getText()), item.label);
                    client.send(msg, function (results) {
                        for (var r = 0; r < results.length; r++) {
                            let result = results[r];
                            if (result.hasOwnProperty('doc')) {
                                item.documentation = result.doc;
                            }
                        }
                        resolve(item);
                        client.end();
                    })
                })
            } else {
                reject("Connect to repl for auto-complete..");
            }
        });
    }
};
