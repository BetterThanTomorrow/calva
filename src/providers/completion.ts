import { TextDocument, Position, CancellationToken, CompletionContext, Hover, CompletionItemKind, window, CompletionList, CompletionItemProvider, CompletionItem } from 'vscode';
import * as state from '../state';
import * as util from '../utilities';
import select from '../select';
import * as docMirror from '../doc-mirror';
import * as infoparser from './infoparser';

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

    async provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext) {
        let text = util.getWordAtPosition(document, position);

        if (util.getConnectedState()) {
            const toplevelSelection = select.getFormSelection(document, position, true),
                toplevel = document.getText(toplevelSelection),
                toplevelStartOffset = document.offsetAt(toplevelSelection.start),
                toplevelStartCursor = docMirror.getDocument(document).getTokenCursor(toplevelStartOffset + 1),
                wordRange = document.getWordRangeAtPosition(position),
                wordStartLocalOffset = document.offsetAt(wordRange.start) - toplevelStartOffset,
                wordEndLocalOffset = document.offsetAt(wordRange.end) - toplevelStartOffset,
                contextStart = toplevel.substring(0, wordStartLocalOffset),
                contextEnd = toplevel.substring(wordEndLocalOffset),
                context = `${contextStart}__prefix__${contextEnd}`,
                toplevelIsValidForm = toplevelStartCursor.withinValidList() && context != '__prefix__',
                ns = util.getNamespace(document),
                client = util.getSession(util.getFileType(document)),
                res = await client.complete(util.getNamespace(document), text, toplevelIsValidForm ? context : null),
                results = res.completions || [];
                if(results) {
                    results.forEach(element => {
                        if(!element['ns']) {
                            // make sure every entry has a namespace 
                            // for the 'info' call.
                            element['ns'] = ns; 
                        }
                    });
                }
            return new CompletionList(
                results.map(item => ({
                    label: item.candidate,
                    kind: this.mappings[item.type] || CompletionItemKind.Text,
                    insertText: item[0] === '.' ? item.slice(1) : item
                })), true);
        }
        return [];
    }

    async resolveCompletionItem(item: CompletionItem, token: CancellationToken) {

        if (util.getConnectedState()) {
            let client = util.getSession(util.getFileType(window.activeTextEditor.document));
            if (client) {
                await util.createNamespaceFromDocumentIfNotExists(window.activeTextEditor.document);
                let result = await client.info(item.insertText["ns"], item.label)
                let [doc, details] = infoparser.getCompletion(result);
                item.documentation = doc;
                item.detail = details;
            }
        }
        return item;
    }
};