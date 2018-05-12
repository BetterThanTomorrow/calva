import vscode from 'vscode';
import { deref } from '../state';
import createReplClient from '../repl/client';
import message from 'goog:calva.repl.message';
import { getNamespace, getSession, getWordAtPosition } from '../utilities';

export default class CompletionItemProvider {
    constructor() {
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

    provideCompletionItems(document, position, _) {
        let text = getWordAtPosition(document, position),
            scope = this,
            filetypeIndex = (document.fileName.lastIndexOf('.') + 1),
            filetype = document.fileName.substr(filetypeIndex, document.fileName.length);
        if (deref().get("connected")) {
            return new Promise((resolve, reject) => {
                let current = deref(),
                    client = createReplClient()
                        .once('connect', () => {
                            let msg = message.completeMsg(getSession(filetype),
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

    resolveCompletionItem(item, _) {
        let editor = vscode.window.activeTextEditor,
            filetypeIndex = (editor.document.fileName.lastIndexOf('.') + 1),
            filetype = editor.document.fileName.substr(filetypeIndex, editor.document.fileName.length);
        return new Promise((resolve, reject) => {
            const current = deref();
            if (current.get('connected')) {
                let client = createReplClient().once('connect', () => {
                    let document = vscode.window.activeTextEditor.document,
                        msg = message.infoMsg(getSession(filetype),
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
