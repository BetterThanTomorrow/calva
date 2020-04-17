import * as vscode from 'vscode';
import * as util from '../utilities';
import * as docMirror from '../doc-mirror';

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

function getTokenRanges(tokenString: string, document: vscode.TextDocument): Array<[number, number]> {
    const docText = document.getText();
    const mirroredDocument = docMirror.getDocument(document);
    let ranges = [];
    let tokenCursor;
    let index = docText.indexOf(tokenString);

    while (index !== -1) {
        tokenCursor = mirroredDocument.getTokenCursor(index);
        if (tokenCursor.getToken().raw === tokenString) {
            ranges.push([index, index + tokenString.length]);
        }
        index = docText.indexOf(tokenString, index + tokenString.length);
    }
    return ranges;
}

async function update(editor: vscode.TextEditor) {
    if (editor) {
        const cljSession = util.getSession('clj');
        if (cljSession) {
            const instrumentedDefs = await cljSession.listDebugInstrumentedDefs();
            const docNamespace = util.getDocumentNamespace(editor.document);
            const instrumentedDefsInEditor = instrumentedDefs.list.filter(([ns, _]) => ns === docNamespace).map(([_, def]) => def);

            const ranges = getTokenRanges(instrumentedDefsInEditor[0], editor.document);
            
            // TODO: Map ranges and create decorations from them using the below code
            const startPos = editor.document.positionAt(0);
            const endPos = editor.document.positionAt(5);
            const decorations = [
                {
                    range: new vscode.Range(startPos, endPos),
                    hoverMessage: 'Instrumented for debugging'
                }
            ];
            editor.setDecorations(instrumentedFunctionDecorationType, decorations);
        }
    }
}

export default {
    update
};