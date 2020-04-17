import * as vscode from 'vscode';
import * as util from '../utilities';
import * as docMirror from '../doc-mirror';
import { LispTokenCursor } from '../cursor-doc/token-cursor';

const instrumentedFunctionDecorationType = vscode.window.createTextEditorDecorationType({
    borderWidth: '1px',
    borderStyle: 'solid',
    overviewRulerColor: 'blue',
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    light: {
        // This color will be used in light color themes
        borderColor: 'darkblue'
    },
    dark: {
        // This color will be used in dark color themes
        borderColor: 'lightblue'
    }
});

function getTokenRanges(tokenStrings: string[], document: vscode.TextDocument): Array<[number, number]> {
    const docText = document.getText();
    const mirroredDocument = docMirror.getDocument(document);
    const ranges = [];

    tokenStrings.forEach(tokenString => {
        let index = docText.indexOf(tokenString);
        let tokenCursor: LispTokenCursor;
        while (index !== -1) {
            tokenCursor = mirroredDocument.getTokenCursor(index);
            if (tokenCursor.getToken().raw === tokenString) {
                ranges.push([index, index + tokenString.length]);
            }
            index = docText.indexOf(tokenString, index + tokenString.length);
        }
    });

    return ranges;
}

let timeout: NodeJS.Timer | undefined = undefined;

async function updateDecorations() {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && /(\.cljc*)$/.test(activeEditor.document.fileName)) {
        const cljSession = util.getSession('clj');
        if (cljSession) {
            const document = activeEditor.document;
            const instrumentedDefs = await cljSession.listDebugInstrumentedDefs();
            const docNamespace = util.getDocumentNamespace(document);
            const instrumentedDefsInEditor = instrumentedDefs.list.filter(alist => alist[0] === docNamespace)[0]?.slice(1) || [];
            const ranges = getTokenRanges(instrumentedDefsInEditor, document);
            const decorations = ranges.map(([startOffset, endOffset]) => {
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

function triggerUpdateDecorations() {
    if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
    }
    timeout = setTimeout(updateDecorations, 50);
}

function activate() {

    triggerUpdateDecorations();

    vscode.window.onDidChangeActiveTextEditor(triggerUpdateDecorations);

    vscode.workspace.onDidChangeTextDocument(event => {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && event.document === activeEditor.document) {
            triggerUpdateDecorations();
        }
    });
}

export default {
    activate,
    triggerUpdateDecorations
};