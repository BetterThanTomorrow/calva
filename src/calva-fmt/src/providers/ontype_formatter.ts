import * as vscode from 'vscode';
import * as formatter from '../format';

export class FormatOnTypeEditProvider implements vscode.OnTypeFormattingEditProvider {
    async provideOnTypeFormattingEdits(document: vscode.TextDocument, p: vscode.Position, ch: string, _options): Promise<vscode.TextEdit[]> {
        const editor = vscode.window.activeTextEditor;
        const pos = editor.selection.active;
        if (vscode.workspace.getConfiguration("calva.fmt").get("formatAsYouType")) {
            if (vscode.workspace.getConfiguration("calva.fmt").get("newIndentEngine")) {
                formatter.indentPosition(pos, document);
            } else {
                try {
                    formatter.formatPosition(vscode.window.activeTextEditor, true).catch(e => {
                        console.error("Calva: Format position failed.", e);
                    });
                } catch (e) {
                    formatter.indentPosition(pos, document);
                }
            }
        }
        return null;
    }
}
