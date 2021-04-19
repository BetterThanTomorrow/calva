import * as vscode from 'vscode';
import * as util from './utilities';

export function continueCommentCommand() {
    const document = util.getDocument({});
    if (document && document.languageId === 'clojure') {
        const editor = vscode.window.activeTextEditor;
        const position = editor.selection.active;
        const eolPosition = position.with(position.line, Infinity);
        const lineRange = new vscode.Range(position.with(position.line, 0), eolPosition);
        const lineText: string = document.getText(lineRange),
            match = lineText.match(/^[ \t]*;+[ \t]*/);
        if (match) {
            const [commentStart] = match;
            //const edit = vscode.TextEdit.insert(eolPosition, `\n${commentStart}`);
            //const wsEdit = new vscode.WorkspaceEdit();
            //wsEdit.set(editor.document.uri, [edit]);
            //vscode.workspace.applyEdit(wsEdit);
            editor.edit(edits => edits.insert(eolPosition, `\n${commentStart}`), { undoStopAfter: false, undoStopBefore: true }).then(fulfilled => {
                if (fulfilled) {
                    const newEolPosition = eolPosition.with(eolPosition.line + 1, commentStart.length);
                    editor.selection = new vscode.Selection(newEolPosition, newEolPosition);
                }
            });
        }
    }
}