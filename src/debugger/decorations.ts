import * as vscode from 'vscode';
import * as namespace from '../namespace';
import * as docMirror from '../doc-mirror';
import { NReplSession } from '../nrepl';
const { parseEdn } = require('../../out/cljs-lib/cljs-lib');
import * as state from '../state';

let enabled = false;
let decorationsSession: NReplSession = null;

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

async function setPrintLength(session: NReplSession, printLength: string): Promise<void> {
    const code = `(set! clojure.core/*print-length* ${printLength})`;
    await session.eval(code, 'user').value;
}

async function getPrintLength(session: NReplSession): Promise<string> {
    const code = `clojure.core/*print-length*`;
    return await session.eval(code, 'user').value;
}

async function getLintAnalysis(session: NReplSession, documentText: string): Promise<any> {
    const printLength = await getPrintLength(session);
    await setPrintLength(session, 'nil');
    const code = `(with-in-str ${JSON.stringify(documentText)} (:analysis (clj-kondo.core/run! {:lint ["-"] :lang :clj :config {:output {:analysis true}}})))`;
    const resEdn = await session.eval(code, 'user').value;
    await setPrintLength(session, printLength);
    return parseEdn(resEdn);
}

function getVarDefinitionRanges(definitions: any[], document: vscode.TextDocument): [number, number][] {
    const mirroredDocument = docMirror.getDocument(document);
    return definitions.map(varInfo => {
        const position = new vscode.Position(varInfo.row - 1, varInfo.col - 1);
        const offset = document.offsetAt(position);
        const tokenCursor = mirroredDocument.getTokenCursor(offset);
        while (tokenCursor.getToken().raw !== varInfo.name && !tokenCursor.atEnd()) {
            tokenCursor.next();
        }
        return [tokenCursor.offsetStart, tokenCursor.offsetEnd];
    });
}

function getVarUsageRanges(usages: any[], document: vscode.TextDocument): [number, number][] {
    const mirroredDocument = docMirror.getDocument(document);
    return usages.map(varInfo => {
        const position = new vscode.Position(varInfo.row - 1, varInfo.col - 1);
        const offset = document.offsetAt(position);
        const tokenCursor = mirroredDocument.getTokenCursor(offset);
        return [offset, tokenCursor.offsetEnd];
    });
}

async function updateDecorations(decorationsSession: NReplSession) {
    const activeEditor = vscode.window.activeTextEditor;

    if (activeEditor && /(\.clj)$/.test(activeEditor.document.fileName)) {
        const cljSession = namespace.getSession('clj');

        if (cljSession) {
            const document = activeEditor.document;

            // Get instrumented defs in current editor
            const docNamespace = namespace.getDocumentNamespace(document);
            const instrumentedDefs = await cljSession.listDebugInstrumentedDefs();
            const instrumentedDefsInEditor = instrumentedDefs.list.filter(alist => alist[0] === docNamespace)[0]?.slice(1) || [];

            // Get editor ranges of instrumented var definitions and usages
            const lintAnalysis = await getLintAnalysis(decorationsSession, document.getText());
            const instrumentedVarDefs = lintAnalysis['var-definitions'].filter(varInfo => instrumentedDefsInEditor.includes(varInfo.name));
            const instrumentedVarDefRanges = getVarDefinitionRanges(instrumentedVarDefs, document);
            const instrumentedVarUsages = lintAnalysis['var-usages'].filter(varInfo => {
                const instrumentedDefsInVarNs = instrumentedDefs.list.filter(l => l[0] === varInfo.to)[0]?.slice(1) || [];
                return instrumentedDefsInVarNs.includes(varInfo.name);
            });
            const instrumentedVarUsageRanges = getVarUsageRanges(instrumentedVarUsages, document);

            const decorations = [...instrumentedVarDefRanges, ...instrumentedVarUsageRanges].map(([startOffset, endOffset]) => {
                return {
                    range: new vscode.Range(document.positionAt(startOffset), document.positionAt(endOffset)),
                    hoverMessage: 'Instrumented for debugging'
                };
            });
            activeEditor.setDecorations(instrumentedFunctionDecorationType, decorations);
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
        timeout = setTimeout(() => updateDecorations(decorationsSession), 50);
    }
}

async function activate() {
    const cljSession = namespace.getSession('clj');
    decorationsSession = await cljSession.clone();

    try {
        await cljSession.eval("(require 'clj-kondo.core)", 'user').value;
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
    } catch (_) {
        const chan = state.outputChannel();
        chan.appendLine('clj-kondo was not found on the classpath. Debugger decorations will not be enabled. More details: https://calva.io/debugger/#dependencies');
    }
}

export default {
    activate,
    triggerUpdateDecorations
};