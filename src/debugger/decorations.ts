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

async function update(editor: vscode.TextEditor) {
    if (editor) {
        const cljSession = util.getSession('clj');
        if (cljSession) {
            const instrumentedDefs = await cljSession.listDebugInstrumentedDefs();
            const docNamespace = util.getDocumentNamespace(editor.document);
            const instrumentedDefsInEditor = instrumentedDefs.list.filter(alist => alist[0] === docNamespace)[0]?.slice(1) || [];
            const ranges = getTokenRanges(instrumentedDefsInEditor, editor.document);
            const decorations = ranges.map(([startOffset, endOffset]) => {
                return {
                    range: new vscode.Range(editor.document.positionAt(startOffset), editor.document.positionAt(endOffset)),
                    hoverMessage: 'Instrumented for debugging'
                };
            });
            editor.setDecorations(instrumentedFunctionDecorationType, decorations);
        }
    }
}

export default {
    update
};