import * as vscode from 'vscode';
import * as formatter from '../format';
import * as docMirror from '../../../doc-mirror/index';
import { EditableDocument } from '../../../cursor-doc/model';
import * as paredit from '../../../cursor-doc/paredit';
import { getConfig } from '../../../config';

export class FormatOnTypeEditProvider implements vscode.OnTypeFormattingEditProvider {
    async provideOnTypeFormattingEdits(document: vscode.TextDocument, _position: vscode.Position, ch: string, _options): Promise<vscode.TextEdit[]> {
        const mDoc: EditableDocument = docMirror.getDocument(document);
        const editor = vscode.window.activeTextEditor;
        let keyMap = vscode.workspace.getConfiguration().get('calva.paredit.defaultKeyMap');
        keyMap = String(keyMap).trim().toLowerCase();
        if ([')', ']', '}'].includes(ch)) {
            if (keyMap === 'strict' && getConfig().strictPreventUnmatchedClosingBracket) {
                const tokenCursor = mDoc.getTokenCursor();
                if (tokenCursor.withinComment()) {
                    return null;
                }
                return paredit.backspace(mDoc).then(fulfilled => {
                    paredit.close(mDoc, ch);
                    return null;
                });
            } else {
                return null;
            }
        }

        const pos = editor.selection.active;
        if (vscode.workspace.getConfiguration("calva.fmt").get("formatAsYouType")) {
            if (vscode.workspace.getConfiguration("calva.fmt").get("newIndentEngine")) {
                formatter.indentPosition(pos, document).then(_v => {
                    return formatter.formatForwardListOnSameLine(mDoc, mDoc.selection.active, true);
                });
            } else {
                try {
                    formatter.formatPositionEditableDoc(mDoc, true).then(_v => {
                        return formatter.formatForwardListOnSameLine(mDoc, mDoc.selection.active, true);
                    });
                } catch (e) {
                    formatter.indentPosition(pos, document).then(_v => {
                        return formatter.formatForwardListOnSameLine(mDoc, mDoc.selection.active, true);
                    });
                }
            }
        }

        return null;
    }
}
