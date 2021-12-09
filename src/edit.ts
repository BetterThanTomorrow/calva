import * as vscode from 'vscode';
import * as util from './utilities';
import * as docMirror from './doc-mirror/index';

// Relies on that `when` claus guards this from being called
// when the cursor is before the comment marker
export function continueCommentCommand() {
    const document = util.getDocument({});
    if (document && document.languageId === 'clojure') {
        const editor = vscode.window.activeTextEditor;
        const position = editor.selection.active;
        const cursor = docMirror.getDocument(document).getTokenCursor();
        if (cursor.getToken().type !== 'comment') {
            if (cursor.getPrevToken().type === 'comment') {
                cursor.previous();
            } else {
                return;
            }
        }
        const commentOffset = cursor.rowCol[1];
        const commentText = cursor.getToken().raw;
        const [_, startText, bullet, num] =
            commentText.match(/^([;\s]+)([*-] +|(\d+)\. +)?/);
        const newNum = num ? parseInt(num) + 1 : undefined;
        const bulletText = newNum ? bullet.replace(/\d+/, '' + newNum) : bullet;
        const pad = ' '.repeat(commentOffset);
        const newText = `${pad}${startText}${bullet ? bulletText : ''}`;
        editor.edit(edits => edits.insert(position, `\n${newText}`), { undoStopAfter: false, undoStopBefore: true }).then(fulfilled => {
            if (fulfilled) {
                const newPosition = position.with(position.line + 1, newText.length);
                editor.selection = new vscode.Selection(newPosition, newPosition);
            }
        });
    }
}
