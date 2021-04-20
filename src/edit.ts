import * as vscode from 'vscode';
import * as util from './utilities';
import * as docMirror from './doc-mirror/index';

export function continueCommentCommand() {
    const document = util.getDocument({});
    if (document && document.languageId === 'clojure') {
        const editor = vscode.window.activeTextEditor;
        const position = editor.selection.active;
        const eolPosition = position.with(position.line, Infinity);
        const cursor = docMirror.getDocument(document).getTokenCursor();
        if (!(cursor.getToken().type === 'comment')) {
            if (cursor.getPrevToken().type === 'comment') {
                cursor.previous();
            } else {
                cursor.next();
            }
        }
        const commentOffset = cursor.rowCol[1];
        const commentText = cursor.getToken().raw;
        const [_1, startText, bullet, num] =
            commentText.match(/^([;\s]+)([*-] +|(\d+)\. )?/);
        const pad = ' '.repeat(commentOffset);
        const newText = `${pad}${startText}${num ? (parseInt(num) + 1) + '. ' : bullet ? bullet : ''}`;
        editor.edit(edits => edits.insert(eolPosition, `\n${newText}`), { undoStopAfter: false, undoStopBefore: true }).then(fulfilled => {
            if (fulfilled) {
                const newEolPosition = eolPosition.with(eolPosition.line + 1, newText.length);
                editor.selection = new vscode.Selection(newEolPosition, newEolPosition);
            }
        });
    }
}