import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { Location } from 'vscode-languageserver-protocol';
import * as _ from 'lodash';
import { NReplSession } from '../nrepl';
import * as util from '../utilities';
import * as lsp from '../lsp';
import { getStateValue } from '../../out/cljs-lib/cljs-lib';
import * as replSession from '../nrepl/repl-session';

let enabled = false;

interface InstrumentedSymbolReferenceLocations {
  [namespace: string]: {
    [symbol: string]: Location[];
  };
}
let instrumentedSymbolReferenceLocations: InstrumentedSymbolReferenceLocations = {};

const instrumentedSymbolDecorationType = vscode.window.createTextEditorDecorationType({
  borderStyle: 'solid',
  overviewRulerColor: 'blue',
  borderWidth: '1px 0px 1px 0px',
  light: {
    backgroundColor: 'rgba(31, 58, 147, 0.05);',
    borderColor: 'rgba(31, 58, 147, 1);',
  },
  dark: {
    backgroundColor: 'rgba(137, 196, 244, 0.1);',
    borderColor: 'rgba(137, 196, 244, 1);',
  },
});

async function update(
  editor: vscode.TextEditor,
  cljSession: NReplSession,
  lspClient: LanguageClient
): Promise<void> {
  if (/(\.clj)$/.test(editor.document.fileName)) {
    if (cljSession && util.getConnectedState() && lspClient) {
      const instrumentedDefs = await cljSession.listDebugInstrumentedDefs();
      if (instrumentedDefs) {
        const instrumentedDefLists = await instrumentedDefs.list;
        instrumentedSymbolReferenceLocations = await instrumentedDefLists.reduce(
          async (
            iSymbolRefLocations: Promise<InstrumentedSymbolReferenceLocations>,
            [namespace, ...instrumentedDefs]: string[]
          ) => {
            const docSymbols = (await lsp.api.getDocumentSymbols(lspClient, editor.document.uri))[0]
              .children;
            const instrumentedDocSymbols = docSymbols.filter((s) =>
              instrumentedDefs.includes(s.name)
            );
            const instrumentedDocSymbolsReferenceRanges = await Promise.all(
              instrumentedDocSymbols.map((s) => {
                const position = {
                  line: s.selectionRange.start.line,
                  character: s.selectionRange.start.character,
                };
                return lsp.api.getReferences(lspClient, editor.document.uri, position);
              })
            );
            const currentNsSymbolsReferenceLocations = instrumentedDocSymbols.reduce(
              (currentLocations, symbol, i) => {
                return {
                  ...currentLocations,
                  [symbol.name]: instrumentedDocSymbolsReferenceRanges[i],
                };
              },
              {}
            );
            return {
              ...(await iSymbolRefLocations),
              [namespace]: currentNsSymbolsReferenceLocations,
            };
          },
          {}
        );
      }
    } else {
      instrumentedSymbolReferenceLocations = {};
    }
  }
}

function render(editor: vscode.TextEditor): void {
  const locations = _.flatten(
    _.flatten(_.values(instrumentedSymbolReferenceLocations).map(_.values))
  );
  const nsSymbolReferenceLocations = locations.filter(
    (loc) => decodeURIComponent(loc.uri) === decodeURIComponent(editor.document.uri.toString())
  );
  const editorDecorationRanges = nsSymbolReferenceLocations.map((loc) => {
    return new vscode.Range(
      loc.range.start.line,
      loc.range.start.character,
      loc.range.end.line,
      loc.range.end.character
    );
  });
  editor.setDecorations(instrumentedSymbolDecorationType, editorDecorationRanges);
}

function renderInAllVisibleEditors(): void {
  vscode.window.visibleTextEditors.forEach((editor) => {
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
    const editor = util.tryToGetActiveTextEditor();
    if (editor) {
      timeout = setTimeout(() => {
        const clientProvider = lsp.getClientProvider();
        const cljSession = replSession.getSession('clj');
        const lspClient = clientProvider.getClientForDocumentUri(editor.document.uri);
        void update(editor, cljSession, lspClient).then(renderInAllVisibleEditors);
      }, 50);
    }
  }
}

function activate() {
  enabled = true;
  triggerUpdateAndRenderDecorations();

  vscode.window.onDidChangeVisibleTextEditors((_) => {
    renderInAllVisibleEditors();
  });

  vscode.workspace.onDidChangeTextDocument((event) => {
    const activeEditor = util.tryToGetActiveTextEditor();
    if (
      activeEditor &&
      event.document === activeEditor.document &&
      event.contentChanges.length > 0
    ) {
      triggerUpdateAndRenderDecorations();
    }
  });
}

export default {
  activate,
  triggerUpdateAndRenderDecorations,
};
