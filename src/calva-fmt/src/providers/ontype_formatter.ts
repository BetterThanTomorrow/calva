import * as vscode from 'vscode';
import * as formatter from '../format';
import * as docMirror from '../../../doc-mirror/index';
import { EditableDocument } from '../../../cursor-doc/model';
import * as paredit from '../../../cursor-doc/paredit';


function continueComment(editor: vscode.TextEditor, document: vscode.TextDocument, position: vscode.Position): Thenable<boolean> {
    const prevLineRange = new vscode.Range(position.with(position.line - 1, 0), position.with(position.line)),
        prevLineText: string = document.getText(prevLineRange),
        match = prevLineText.match(/^[ \t]*;+[ \t]*/);
    if (match) {
        const [commentStart] = match;
        return editor.edit(edits => edits.insert(position.with(position.line, 0), commentStart), { undoStopAfter: false, undoStopBefore: true });
    } else {
        return new Promise((resolve, _reject) => {
            resolve(true);
        });
    }
}

export class FormatOnTypeEditProvider implements vscode.OnTypeFormattingEditProvider {
    async provideOnTypeFormattingEdits(document: vscode.TextDocument, _position: vscode.Position, ch: string, _options): Promise<vscode.TextEdit[]> {
        let keyMap = vscode.workspace.getConfiguration().get('calva.paredit.defaultKeyMap');
        keyMap = String(keyMap).trim().toLowerCase();
        if (keyMap === 'strict' && [')', ']', '}'].includes(ch)) {
            const mDoc: EditableDocument = docMirror.getDocument(document);
            return paredit.backspace(mDoc).then(fulfilled => {
                console.log(fulfilled);
                paredit.close(mDoc, ch);
                return null;
            });
        }
        const editor = vscode.window.activeTextEditor;

        continueComment(editor, document, editor.selection.active).then(() => {
            const pos = editor.selection.active;
            if (vscode.workspace.getConfiguration("calva.fmt").get("formatAsYouType")) {
                if (vscode.workspace.getConfiguration("calva.fmt").get("newIndentEngine")) {
                    return formatter.indentPosition(pos, document);
                } else {
                    try {
                        return formatter.formatPosition(editor, true);
                    } catch (e) {
                        return formatter.indentPosition(pos, document);
                    }
                }
            }
        });
        return null;
    }
}
