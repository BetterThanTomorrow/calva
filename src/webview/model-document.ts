import * as vscode from 'vscode';
import { LineInputModel, EditableModel } from "./model";
import { LispTokenCursor } from "./token-cursor";
import { TextDocument, EndOfLine } from "vscode";

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

    insertString(offset: number, text: string, oldSelection?: [number, number], newSelection?: [number, number]) {
        const editor = vscode.window.activeTextEditor,
            document = editor.document;
        editor.edit(edits => {
            edits.insert(document.positionAt(offset), text);
        });
    }

    async changeRange(start: number, end: number, text: string, oldSelection?: [number, number], newSelection?: [number, number]) {
        const editor = vscode.window.activeTextEditor,
            document = editor.document,
            range = new vscode.Range(document.positionAt(start), document.positionAt(end));
        editor.edit(edits => {
            edits.replace(range, text);
        });
    }

    async deleteRange(offset: number, count: number, oldSelection?: [number, number], newSelection?: [number, number]) {
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