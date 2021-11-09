import * as vscode from 'vscode';
import * as formatter from '../format';
import * as formatterConfig from '../config';
import * as docMirror from '../../../doc-mirror/index';
import { EditableDocument } from '../../../cursor-doc/model';
import * as paredit from '../../../cursor-doc/paredit';

export class FormatOnTypeEditProvider implements vscode.OnTypeFormattingEditProvider {
    async provideOnTypeFormattingEdits(document: vscode.TextDocument, p: vscode.Position, ch: string, _options): Promise<vscode.TextEdit[]> {
        const mDoc: EditableDocument = docMirror.getDocument(document);
        const tokenCursor = mDoc.getTokenCursor();
        const editor = vscode.window.activeTextEditor;
        const parinferOn = formatterConfig.getConfig()['infer-parens-as-you-type'] as boolean;
        const formatForwardOn = formatterConfig.getConfig()['format-forward-list-on-same-line'] as boolean;
        let keyMap = vscode.workspace.getConfiguration().get('calva.paredit.defaultKeyMap');
        keyMap = String(keyMap).trim().toLowerCase();
        if ([')', ']', '}'].includes(ch)) {
            if (!parinferOn && keyMap === 'strict' && !tokenCursor.withinComment()) {
                return paredit.backspace(mDoc).then(fulfilled => {
                    return null;
                });
            }
        }
        if (['(', '[', '{'].includes(ch)) {
            if (!parinferOn && keyMap === 'strict' && !tokenCursor.withinComment()) {
                const close = {
                    '(': ')',
                    '[': ']',
                    '{': '}'
                }[ch];
                return paredit.insert(mDoc, close).then(fulfilled => {
                    return null;
                });
            }
        }
        else {
            const pos = editor.selection.active;
            if (vscode.workspace.getConfiguration("calva.fmt").get("formatAsYouType")) {
                if (vscode.workspace.getConfiguration("calva.fmt").get("newIndentEngine")) {
                    formatter.indentPosition(pos, document).then(_v => {
                        if (formatForwardOn) {
                            //return formatter.formatForward(mDoc, mDoc.selection.active, true);
                        }
                    });
                } else {
                    try {
                        formatter.formatPositionEditableDoc(mDoc, true).then(_v => {
                            if (formatForwardOn) {
                                //return formatter.formatForward(mDoc, mDoc.selection.active, true);
                            }    
                        });
                    } catch (e) {
                        formatter.indentPosition(pos, document).then(_v => {
                            if (formatForwardOn) {
                                //return formatter.formatForward(mDoc, mDoc.selection.active, true);
                            }    
                        });
                    }
                }
            }
        }
        return null;
    }
}
