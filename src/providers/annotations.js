const vscode = require('vscode');

const evalAnnotationDecoration = vscode.window.createTextEditorDecorationType({
    before: {
        textDecoration: 'none',
        fontWeight: 'normal',
        fontStyle: 'normal',
    },
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen
});

function evaluated(contentText, hasError) {
    return {
        renderOptions: {
            before: {
                contentText: contentText,
            },
            light: {
                before: {
                    color: hasError ? 'rgb(255, 127, 127)' : 'black',
                    backgroundColor: 'white',
                },
            },
            dark: {
                before: {
                    color: hasError ? 'rgb(255, 175, 175)' : 'white',
                    backgroundColor: 'black',
                }
            },
        },
    }
}

const evalSelectionDecorationType = vscode.window.createTextEditorDecorationType({
    overviewRulerColor: 'blue',
    backgroundColor: new vscode.ThemeColor('editor.wordHighlightStrongBackground'),
    overviewRulerLane: vscode.OverviewRulerLane.Right,
});

function decorateResults(decoration, codeSelection, editor) {
    decoration.range = new vscode.Selection(codeSelection.end, codeSelection.end);
    editor.setDecorations(evalAnnotationDecoration, [decoration]);
    setTimeout(() => {
        let subscription = vscode.window.onDidChangeTextEditorSelection((e) => {
            subscription.dispose();
            editor.setDecorations(evalAnnotationDecoration, []);
        });
    }, 350);
}

function decorateSelection(decoration, codeSelection, editor) {
    decoration.range = codeSelection;
    editor.setDecorations(evalSelectionDecorationType, [decoration]);
    setTimeout(() => {
        let subscription = vscode.window.onDidChangeTextEditorSelection((e) => {
            subscription.dispose();
            editor.setDecorations(evalSelectionDecorationType, []);
        });
    }, 350);
}

module.exports = {
    evalAnnotationDecoration,
    evaluated,
    evalSelectionDecorationType,
    decorateResults,
    decorateSelection
}