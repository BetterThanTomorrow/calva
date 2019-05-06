import * as vscode from 'vscode';
import * as formatter from '../format';
import { getIndent, getDocument, getDocumentOffset } from "../docmirror";

export class FormatOnTypeEditProvider {
    async provideOnTypeFormattingEdits(document: vscode.TextDocument, position: vscode.Position, _ch, _options) {
        if (vscode.workspace.getConfiguration("calva.fmt").get("formatAsYouType")) {
            if (vscode.workspace.getConfiguration("calva.fmt").get("newIndentEngine")) {
                let editor = vscode.window.activeTextEditor;
                let pos = new vscode.Position(position.line, 0);
                let indent = getIndent(getDocument(document), getDocumentOffset(document, position))

                let delta = document.lineAt(position.line).firstNonWhitespaceCharacterIndex - indent;
                if (delta > 0) {
                    //return [vscode.TextEdit.delete(new vscode.Range(pos, new vscode.Position(pos.line, delta)))];
                    editor.edit(edits => edits.delete(new vscode.Range(pos, new vscode.Position(pos.line, delta))), { undoStopAfter: false, undoStopBefore: false });
                } else if (delta < 0) {
                    let str = "";
                    while (delta++ < 0)
                        str += " "
                    //return [vscode.TextEdit.insert(pos, str)];
                    editor.edit(edits => edits.insert(pos, str), { undoStopAfter: false, undoStopBefore: false });
                }
            } else {
                formatter.formatPosition(vscode.window.activeTextEditor, true);
            }
        }
        return null;
    }
}