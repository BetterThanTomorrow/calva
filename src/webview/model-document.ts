import * as vscode from 'vscode';
import { TextDocument, EndOfLine } from "vscode";
import { LineInputModel, EditableModel, ModelEdit } from "./model";
import { LispTokenCursor } from "./token-cursor";
import * as formatter from '../calva-fmt/src/format'

export interface ModelDocument {
    selectionStart: number,
    selectionEnd: number,
    model: EditableModel,
    growSelectionStack: [number, number][],
    getTokenCursor: (offset?: number, previous?: boolean) => LispTokenCursor,
    insertString: (text: string) => void,
    getSelection: () => string,
    delete: () => void,
    backspace: () => void;
}

export class DocumentModel implements EditableModel {
    constructor(private document: TextDocument) { }

    lineInputModel = new LineInputModel(this.document.eol == EndOfLine.CRLF ? 2 : 1);

    edit(modelEdits: ModelEdit[]) {
        const editor = vscode.window.activeTextEditor;
        editor.edit(builder => {
            for (const modelEdit of modelEdits) {
                switch (modelEdit.editFn) {
                    case 'insertString':
                        this.insertEdit.apply(this, [builder, ...modelEdit.args]);
                        break;
                    case 'changeRange':
                        this.replaceEdit.apply(this, [builder, ...modelEdit.args]);
                        break;
                    case 'deleteRange':
                        this.deleteEdit.apply(this, [builder, ...modelEdit.args]);
                        break;
                    default:
                        break;
                }
            }
        }, { undoStopBefore: true, undoStopAfter: false }).then(isFulfilled => {
            if (isFulfilled) {
                formatter.formatPosition(editor);
            }
        });
    }

    private insertEdit(builder: vscode.TextEditorEdit, offset: number, text: string, oldSelection?: [number, number], newSelection?: [number, number]) {
        const editor = vscode.window.activeTextEditor,
            document = editor.document;
        builder.insert(document.positionAt(offset), text);
    }

    insertString(offset: number, text: string, oldSelection?: [number, number], newSelection?: [number, number]) {
        const editor = vscode.window.activeTextEditor;
        editor.edit(edits => {
            this.insertEdit(edits, offset, text, oldSelection, newSelection);
        });
    }

    private replaceEdit(builder: vscode.TextEditorEdit, start: number, end: number, text: string, oldSelection?: [number, number], newSelection?: [number, number]) {
        const editor = vscode.window.activeTextEditor,
            document = editor.document,
            range = new vscode.Range(document.positionAt(start), document.positionAt(end));
        builder.replace(range, text);

    }

    changeRange(start: number, end: number, text: string, oldSelection?: [number, number], newSelection?: [number, number]) {
        const editor = vscode.window.activeTextEditor,
            document = editor.document,
            range = new vscode.Range(document.positionAt(start), document.positionAt(end));
        editor.edit(edits => {
            edits.replace(range, text);
        });
    }

    private deleteEdit(builder: vscode.TextEditorEdit, offset: number, count: number, oldSelection?: [number, number], newSelection?: [number, number]) {
        const editor = vscode.window.activeTextEditor,
            document = editor.document,
            range = new vscode.Range(document.positionAt(offset), document.positionAt(offset + count));
        builder.delete(range);
    }

    deleteRange(offset: number, count: number, oldSelection?: [number, number], newSelection?: [number, number]) {
        const editor = vscode.window.activeTextEditor,
            document = editor.document,
            range = new vscode.Range(document.positionAt(offset), document.positionAt(offset + count));
        editor.edit(edits => {
            edits.delete(range);
        });
    }

    getText(start: number, end: number, mustBeWithin = false) {
        return this.lineInputModel.getText(start, end, mustBeWithin);
    }

    getOffsetForLine(line: number) {
        return this.lineInputModel.getOffsetForLine(line);
    }

    public getTokenCursor(offset: number, previous: boolean = false) {
        return this.lineInputModel.getTokenCursor(offset, previous);
    }
}