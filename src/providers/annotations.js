const vscode = require('vscode');

const evalAnnotationDecoration = vscode.window.createTextEditorDecorationType({
    before: {
        textDecoration: 'none',
        fontWeight: 'normal',
        fontStyle: 'normal',
    },
    light: {
        before: {
            color: 'black',
            backgroundColor: 'white',
        },
    },
    dark: {
        before: {
            color: 'white',
            backgroundColor: 'black',
        }
    },
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen
});

function evaluated(contentText) {
    return {
        renderOptions: {
            before: {
                contentText: contentText,
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