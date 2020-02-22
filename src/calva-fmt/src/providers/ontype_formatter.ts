import * as vscode from 'vscode';
import * as formatter from '../format';

function continueComment(editor: vscode.TextEditor, document: vscode.TextDocument, position: vscode.Position): Thenable<boolean> {
    const prevLineRange = new vscode.Range(position.with(position.line - 1, 0), position.with(position.line)),
        prevLineText: string = document.getText(prevLineRange),
        match = prevLineText.match(/^[ \t]*;;[ \t]*/);
    console.log(match);
    if (match) {
        const [commentStart] = match;
        return editor.edit(edits => edits.insert(position.with(position.line, 0), commentStart), { undoStopAfter: false, undoStopBefore: true });
    } else {
        return new Promise((resolve, _reject) => {
            resolve(true);
        });
    }
}

export class FormatOnTypeEditProvider {
    async provideOnTypeFormattingEdits(document: vscode.TextDocument, _position: vscode.Position, _ch, _options) {
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
