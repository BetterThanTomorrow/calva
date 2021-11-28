import * as vscode from 'vscode';
import { getDocument } from '../../../doc-mirror';
import { getConfig } from '../config';
import * as formatter from '../format';

export class FormatOnTypeEditProvider implements vscode.OnTypeFormattingEditProvider {
    async provideOnTypeFormattingEdits(document: vscode.TextDocument, p: vscode.Position, ch: string, _options): Promise<vscode.TextEdit[]> {
        console.count(`provideOnTypeFormattingEdits, ch: ${ch}`);
        const editor = vscode.window.activeTextEditor;
        const pos = editor.selection.active;
        if (vscode.workspace.getConfiguration("calva.fmt").get("formatAsYouType") && !(getConfig()['infer-parens-as-you-type'] || getConfig()['format-forward-as-you-type'])) {
            if (vscode.workspace.getConfiguration("calva.fmt").get("newIndentEngine")) {
                formatter.indentPosition(pos, document);
                //formatter.indentPositionEditableDoc(getDocument(document));
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
