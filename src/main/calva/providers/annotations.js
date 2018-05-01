const vscode = require('vscode');

const evalResultsDecorationType = vscode.window.createTextEditorDecorationType({
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

function clearEvaluationDecorations(editor) {
    editor.setDecorations(evalResultsDecorationType, []);
    editor.setDecorations(evalSelectionDecorationType, []);
}

function decorateResults(resultString, hasError, codeSelection, editor) {
    let decoration = evaluated(resultString, hasError)
    decoration.range = new vscode.Selection(codeSelection.end, codeSelection.end);
    editor.setDecorations(evalResultsDecorationType, [decoration]);
    setTimeout(() => {
        let subscription = vscode.window.onDidChangeTextEditorSelection(() => {
            subscription.dispose();
            editor.setDecorations(evalResultsDecorationType, []);
        });
    }, 350);
}

function decorateSelection(codeSelection, editor) {
    editor.setDecorations(evalSelectionDecorationType, [{ range: codeSelection }]);
    setTimeout(() => {
        let subscription = vscode.window.onDidChangeTextEditorSelection(() => {
            subscription.dispose();
            editor.setDecorations(evalSelectionDecorationType, []);
        });
    }, 350);
}

module.exports = {
    evalResultsDecorationType,
    evaluated,
    evalSelectionDecorationType,
    clearEvaluationDecorations,
    decorateResults,
    decorateSelection
}