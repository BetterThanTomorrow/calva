import * as vscode from 'vscode';
import * as namespace from '../namespace';
import * as state from '../state';
import { LanguageClient } from 'vscode-languageclient';
import { Position, Location, DocumentSymbol } from 'vscode-languageserver-protocol';
import lsp from '../lsp';
import * as _ from 'lodash';
import { NReplSession } from '../nrepl';

let enabled = false;

const instrumentedFunctionDecorationType = vscode.window.createTextEditorDecorationType({
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

async function getReferences(lspClient: LanguageClient, uri: string, position: Position): Promise<Location[] | null> {
    const result: Location[] = await lspClient.sendRequest('textDocument/references', {
        textDocument: {
            uri,
        },
        position,
        context: {
            includeDeclaration: true
        }
    });
    return result;
}

async function getDocumentSymbols(lspClient: LanguageClient, uri: string): Promise<DocumentSymbol[]> {
    const result: DocumentSymbol[] = await lspClient.sendRequest('textDocument/documentSymbol', {
        textDocument: {
            uri
        }
    });
    return result;
}

async function updateDecorations(cljSession: NReplSession) {
    const activeEditor = vscode.window.activeTextEditor;

    if (activeEditor && /(\.clj)$/.test(activeEditor.document.fileName)) {
        if (cljSession) {
            const document = activeEditor.document;

            // Get instrumented defs in current editor
            const docNamespace = namespace.getDocumentNamespace(document);
            const instrumentedDefs = await cljSession.listDebugInstrumentedDefs();
            const instrumentedDefsInEditor = instrumentedDefs.list.filter(alist => alist[0] === docNamespace)[0]?.slice(1) || [];

            // Find ranges of instrumented defs
            const documentUri = document.uri.toString();
            const lspClient = state.deref().get(lsp.LSP_CLIENT_KEY);
            const documentSymbols = await getDocumentSymbols(lspClient, documentUri);
            const instrumentedSymbolRanges = documentSymbols[0].children.filter(s => instrumentedDefsInEditor.includes(s.name)).map(s => s.range);
            const instrumentedSymbolReferences = _.flatten(await Promise.all(instrumentedSymbolRanges.map(range => {
                const position = {
                    line: range.start.line,
                    character: range.start.character
                };
                return getReferences(lspClient, documentUri, position);
            }))).filter(ref => ref.uri === documentUri);
            const instrumentedSymbolReferenceRanges = instrumentedSymbolReferences.map(ref => ref.range);

            // Combine the symbol range with its references' ranges and create vscode Ranges
            const decorationRanges = [...instrumentedSymbolRanges, ...instrumentedSymbolReferenceRanges].map(range => {
                return new vscode.Range(range.start.line, range.start.character, range.end.line, range.end.character);
            });
            activeEditor.setDecorations(instrumentedFunctionDecorationType, decorationRanges);
        } else {
            activeEditor.setDecorations(instrumentedFunctionDecorationType, []);
        }
    }
}

let timeout: NodeJS.Timer | undefined = undefined;

function triggerUpdateDecorations() {
    if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
    }
    if (enabled) {
        timeout = setTimeout(() => {
            const cljSession = namespace.getSession('clj');
            updateDecorations(cljSession);
        }, 50);
    }
}

async function activate() {
    enabled = true;
    triggerUpdateDecorations();

    vscode.window.onDidChangeActiveTextEditor(_ => {
        triggerUpdateDecorations();
    });

    vscode.workspace.onDidChangeTextDocument(event => {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && event.document === activeEditor.document && event.contentChanges.length > 0) {
            triggerUpdateDecorations();
        }
    });
}

export default {
    activate,
    triggerUpdateDecorations
};