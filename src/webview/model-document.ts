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

    edit(edits: ModelEdit[]) {
        const editor = vscode.window.activeTextEditor,
            document = editor.document,
            editorEdits = edits.map(edit => {
                switch (edit.editFn) {
                    case 'insertString':
                        return this.insertEdit.apply(this, edit.args);
                    case 'changeRange':
                        return this.replaceEdit.apply(this, edit.args);
                    case 'deleteRange':
                        return this.deleteEdit.apply(this, edit.args);
                    default:
                        break;
                }
            }),
            wsEdit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();
        wsEdit.set(document.uri, editorEdits);
        return vscode.workspace.applyEdit(wsEdit).then(isFulfilled => {
            if (isFulfilled) {
                formatter.formatPosition(editor);
            }
        });
    }

    private insertEdit(offset: number, text: string, oldSelection?: [number, number], newSelection?: [number, number]): vscode.TextEdit {
        const editor = vscode.window.activeTextEditor,
            document = editor.document;
        return vscode.TextEdit.insert(document.positionAt(offset), text);
    }

    insertString(offset: number, text: string, oldSelection?: [number, number], newSelection?: [number, number]) {
        const editor = vscode.window.activeTextEditor,
            insertEdit = this.insertEdit(offset, text, oldSelection, newSelection);
        editor.edit(_edits => {
            insertEdit;
        });
    }

    private replaceEdit(start: number, end: number, text: string, oldSelection?: [number, number], newSelection?: [number, number]): vscode.TextEdit {
        const editor = vscode.window.activeTextEditor,
            document = editor.document,
            range = new vscode.Range(document.positionAt(start), document.positionAt(end));
        return vscode.TextEdit.replace(range, text);

    }

    changeRange(start: number, end: number, text: string, oldSelection?: [number, number], newSelection?: [number, number]) {
        const editor = vscode.window.activeTextEditor,
            document = editor.document,
            range = new vscode.Range(document.positionAt(start), document.positionAt(end));
        editor.edit(edits => {
            edits.replace(range, text);
        });
    }

    private deleteEdit(offset: number, count: number, oldSelection?: [number, number], newSelection?: [number, number]): vscode.TextEdit {
        const editor = vscode.window.activeTextEditor,
            document = editor.document,
            range = new vscode.Range(document.positionAt(offset), document.positionAt(offset + count));
        return vscode.TextEdit.delete(range);
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