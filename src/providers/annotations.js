const vscode = require('vscode');

const evalAnnotationDecoration = vscode.window.createTextEditorDecorationType({
    before: {
        margin: '0 1em 0 1em',
        textDecoration: 'none'
    },
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen
});

function evaluated(contentText) {
    return {
        renderOptions: {
            before: {
                backgroundColor: new vscode.ThemeColor("editor.backgroundColor"),
                color: new vscode.ThemeColor("editorCodeLens.foreground"),
                contentText: contentText,
                fontWeight: 'normal',
                fontStyle: 'normal'
            }
        }
    }
}

module.exports = {
    evalAnnotationDecoration,
    evaluated
}