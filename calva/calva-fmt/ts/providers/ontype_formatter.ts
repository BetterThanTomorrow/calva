import * as vscode from 'vscode';
import * as formatter from '../format';

export class FormatOnTypeEditProvider {
    async provideOnTypeFormattingEdits(document: vscode.TextDocument, position: vscode.Position, _ch, _options) {
        if (vscode.workspace.getConfiguration("calva.fmt").get("formatAsYouType")) {
            if (vscode.workspace.getConfiguration("calva.fmt").get("newIndentEngine")) {
                formatter.indentPosition(position, document);
            } else {
                try {
                    formatter.formatPosition(vscode.window.activeTextEditor, true);
                } catch (e) {
                    formatter.indentPosition(position, document);
                }

            }
        }
        return null;
    }
}
