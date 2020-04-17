import * as vscode from 'vscode';
import * as util from '../utilities';

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

async function update(editor: vscode.TextEditor) {
    const cljSession = util.getSession('clj');
    if (cljSession) {
        const instrumentedDefs = await cljSession.listDebugInstrumentedDefs();
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

export default {
    update
};