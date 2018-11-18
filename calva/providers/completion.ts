import { TextDocument, Position, CancellationToken, CompletionContext, Hover, CompletionItemKind, window, CompletionList, CompletionItemProvider, CompletionItem } from 'vscode';
import * as state from '../state';
import repl from '../repl/client';
import * as util from '../utilities';
import { Context } from 'vm';
import * as calvaLib from '../../lib/calva';

export default class CalvaCompletionItemProvider implements CompletionItemProvider {
    state: any;
    mappings: any;
    constructor() {
        this.state = state;
        this.mappings = {
            'nil': CompletionItemKind.Value,
            'macro': CompletionItemKind.Value,
            'class': CompletionItemKind.Class,
            'keyword': CompletionItemKind.Keyword,
            'namespace': CompletionItemKind.Module,
            'function': CompletionItemKind.Function,
            'special-form': CompletionItemKind.Keyword,
            'var': CompletionItemKind.Variable,
            'method': CompletionItemKind.Method
        };
    }

    provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext) {
        let text = util.getWordAtPosition(document, position),
            scope = this,
            filetypeIndex = (document.fileName.lastIndexOf('.') + 1),
            filetype = document.fileName.substr(filetypeIndex, document.fileName.length);
        if (this.state.deref().get("connected")) {
            return new Promise<CompletionList>((resolve, reject) => {
                let current = this.state.deref(),
                    client = calvaLib.nrepl_create(repl.getDefaultOptions())
                        .once('connect', () => {
                            let msg = calvaLib.message_completeMsg(util.getSession(filetype),
                                util.getNamespace(document.getText()), text),
                                completions = [];
                            client.send(msg, function (results) {
                                for (var r = 0; r < results.length; r++) {
                                    let result = results[r];
                                    if (result.hasOwnProperty('completions')) {
                                        for (let c = 0; c < result.completions.length; c++) {
                                            let item = result.completions[c];
                                            completions.push({
                                                label: item.candidate,
                                                kind: scope.mappings[item.type] || CompletionItemKind.Text,
                                                insertText: item[0] === '.' ? item.slice(1) : item
                                            });
                                        }
                                    }
                                }
                                if (completions.length > 0) {
                                    resolve(new CompletionList(completions, true));
                                } else {
                                    resolve(new CompletionList(completions, true));
                                }
                                client.end();
                            });
                        });
            });
        } else {
            return [];
        }
    }

    resolveCompletionItem(item: CompletionItem, token: CancellationToken) {
        let editor = window.activeTextEditor,
            filetypeIndex = (editor.document.fileName.lastIndexOf('.') + 1),
            filetype = editor.document.fileName.substr(filetypeIndex, editor.document.fileName.length);
        return new Promise<CompletionItem>((resolve, reject) => {
            let current = this.state.deref();
            if (current.get('connected')) {
                let client = calvaLib.nrepl_create(repl.getDefaultOptions()).once('connect', () => {
                    let document = window.activeTextEditor.document,
                        msg = calvaLib.message_infoMsg(util.getSession(filetype),
                            util.getNamespace(document.getText()), item.label);
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
