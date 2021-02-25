import * as vscode from 'vscode';
import * as namespace from '../namespace';
import * as state from '../state';
import { LanguageClient } from 'vscode-languageclient';
import { Location } from 'vscode-languageserver-protocol';
import * as _ from 'lodash';
import { NReplSession } from '../nrepl';
import * as util from '../utilities';
import lsp from '../lsp';

let enabled = false;

interface InstrumentedSymbolReferenceLocations {
    [namespace: string]: {
        [symbol: string]: Location[]
    }
}
let instrumentedSymbolReferenceLocations: InstrumentedSymbolReferenceLocations = {};

const instrumentedSymbolDecorationType = vscode.window.createTextEditorDecorationType({
    borderStyle: 'solid',
    overviewRulerColor: 'blue',
    borderWidth: '1px 0px 1px 0px',
    light: {
        backgroundColor: 'rgba(31, 58, 147, 0.05);',
        borderColor: 'rgba(31, 58, 147, 1);'
    },
    dark: {
        backgroundColor: 'rgba(137, 196, 244, 0.1);',
        borderColor: 'rgba(137, 196, 244, 1);'
    }
});

async function update(editor: vscode.TextEditor, cljSession: NReplSession, lspClient: LanguageClient): Promise<void> {
    if (/(\.clj)$/.test(editor.document.fileName)) {
        if (cljSession && util.getConnectedState() && lspClient) {
            const instrumentedDefLists = (await cljSession.listDebugInstrumentedDefs()).list;

            instrumentedSymbolReferenceLocations = await instrumentedDefLists.reduce(
                async (iSymbolRefLocations: Promise<InstrumentedSymbolReferenceLocations>, [namespace, ...instrumentedDefs]: string[]) => {
                    const namespacePath = (await cljSession.nsPath(namespace)).path;
                    const docUri = vscode.Uri.parse(namespacePath, true);
                    const decodedDocUri = decodeURIComponent(docUri.toString());
                    const docSymbols = (await lsp.getDocumentSymbols(lspClient, decodedDocUri))[0].children;
                    const instrumentedDocSymbols = docSymbols.filter(s => instrumentedDefs.includes(s.name));
                    const instrumentedDocSymbolsReferenceRanges = await Promise.all(instrumentedDocSymbols.map(s => {
                        const position = {
                            line: s.selectionRange.start.line,
                            character: s.selectionRange.start.character
                        };
                        return lsp.getReferences(lspClient, decodedDocUri, position);
                    }));
                    const currentNsSymbolsReferenceLocations = instrumentedDocSymbols.reduce((currentLocations, symbol, i) => {
                        return {
                            ...currentLocations,
                            [symbol.name]: instrumentedDocSymbolsReferenceRanges[i]
                        }
                    }, {});
                    return {
                        ...(await iSymbolRefLocations),
                        [namespace]: currentNsSymbolsReferenceLocations
                    };
                }, {});
        } else {
            instrumentedSymbolReferenceLocations = {};
        }
    }
}

function render(editor: vscode.TextEditor): void {
    const locations = _.flatten(_.flatten(_.values(instrumentedSymbolReferenceLocations).map(_.values)));
    const nsSymbolReferenceLocations = locations.filter(loc => decodeURIComponent(loc.uri) === decodeURIComponent(editor.document.uri.toString()));
    const editorDecorationRanges = nsSymbolReferenceLocations.map(loc => {
        return new vscode.Range(loc.range.start.line, loc.range.start.character, loc.range.end.line, loc.range.end.character);
    });
    editor.setDecorations(instrumentedSymbolDecorationType, editorDecorationRanges);
}

function renderInAllVisibleEditors(): void {
    vscode.window.visibleTextEditors.forEach(editor => {
        render(editor);
    });
}

let timeout: NodeJS.Timer | undefined = undefined;

function triggerUpdateAndRenderDecorations() {
    if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
    }
    if (enabled) {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            timeout = setTimeout(() => {
                const cljSession = namespace.getSession('clj');
                const lspClient = state.deref().get(lsp.LSP_CLIENT_KEY);
                update(editor, cljSession, lspClient).then(renderInAllVisibleEditors);
            }, 50);
        }
    }
}

async function activate() {
    enabled = true;
    triggerUpdateAndRenderDecorations();

    vscode.window.onDidChangeVisibleTextEditors(_ => {
        renderInAllVisibleEditors();
    });

    vscode.workspace.onDidChangeTextDocument(event => {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && event.document === activeEditor.document && event.contentChanges.length > 0) {
            triggerUpdateAndRenderDecorations();
        }
    });
}

export default {
    activate,
    triggerUpdateAndRenderDecorations
};