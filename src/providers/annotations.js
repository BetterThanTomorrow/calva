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

module.exports = {
    evalAnnotationDecoration,
    evaluated,
    evalSelectionDecorationType
}