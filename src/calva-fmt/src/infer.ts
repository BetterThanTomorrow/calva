import { start } from 'repl';
import * as vscode from 'vscode';
import * as docModel from '../../cursor-doc/model';
const { inferParens, inferIndents } = require('../../../out/cljs-lib/cljs-lib');
import * as docMirror from '../../doc-mirror';


interface CFEdit {
    edit: string,
    start: { line: number, character: number },
    end: { line: number, character: number },
    text?: string
}

interface CFError {
    message: string
}

interface ResultOptions {
    success: boolean,
    //"new-text": string,
    edits?: [CFEdit],
    line?: number,
    character?: number,
    error?: CFError,
    "error-msg"?: string
}

function rowColToOffset(document: docModel.EditableDocument, row: number, col: number) {
    const lineOffset = document.model.getOffsetForLine(row);
    return lineOffset + col;
}

export function inferParensOnDocMirror(document: docModel.EditableDocument) {
    const p = document.selection.active;
    const [row, col] = document.getTokenCursor().rowCol;
    const currentText = document.model.getText(0, Infinity);
    const r: ResultOptions = inferParens({
            "text": currentText,
            "line": row,
            "character": col,
            "previous-line": row,
            "previous-character": col
    });
    if (r.edits && r.edits?.length > 0) {
        let diffLengthBeforeCursor = 0;
        const modelEdits = r.edits?.map(edit => {
            const start = rowColToOffset(document, edit.start.line, edit.start.character);
            const end = rowColToOffset(document, edit.end.line, edit.end.character);
            if (edit.end.line < row) {
                diffLengthBeforeCursor += edit.text.length - (end - start);
            }
            return new docModel.ModelEdit('changeRange', [start, end, edit.text]);
        });
        const rP = rowColToOffset(document, r.line, r.character);
        const newP = rP + diffLengthBeforeCursor;
        document.model.edit(modelEdits, {
            selection: new docModel.ModelEditSelection(newP),
            skipFormat: true,
            undoStopBefore: false,
            performInferParens: false
        });
    }
}


export function inferParensCommand(editor: vscode.TextEditor) {
    const position: vscode.Position = editor.selection.active,
        document = editor.document,
        currentText = document.getText(),
        r: ResultOptions = inferParens({
            "text": currentText,
            "line": position.line,
            "character": position.character,
            "previous-line": position.line,
            "previous-character": position.character
        });
    applyResults(r, editor);
}

export function indentCommand(editor: vscode.TextEditor, spacing: string, forward: boolean = true) {
    const prevPosition: vscode.Position = editor.selection.active,
        document = editor.document;
    let deletedText = "",
        doEdit = true;

    editor.edit(editBuilder => {
        if (forward) {
            editBuilder.insert(new vscode.Position(prevPosition.line, prevPosition.character), spacing)
        } else {
            const startOfLine = new vscode.Position(prevPosition.line, 0),
                headRange = new vscode.Range(startOfLine, prevPosition),
                headText = document.getText(headRange),
                xOfFirstLeadingSpace = headText.search(/ *$/),
                leadingSpaces = xOfFirstLeadingSpace >= 0 ? prevPosition.character - xOfFirstLeadingSpace : 0;
            if (leadingSpaces > 0) {
                const spacingSize = Math.max(spacing.length, 1),
                    deleteRange = new vscode.Range(prevPosition.translate(0, -spacingSize), prevPosition);
                deletedText = document.getText(deleteRange);
                editBuilder.delete(deleteRange);
            } else {
                doEdit = false;
            }
        }
    }, { undoStopAfter: false, undoStopBefore: false }).then((_onFulfilled: boolean) => {
        if (doEdit) {
            const position: vscode.Position = editor.selection.active,
                currentText = document.getText(),
                r: ResultOptions = inferIndents({
                    "text": currentText,
                    "line": position.line,
                    "character": position.character,
                    "previous-line": prevPosition.line,
                    "previous-character": prevPosition.character,
                    "changes": [{
                        "line": forward ? prevPosition.line : position.line,
                        "character": forward ? prevPosition.character : position.character,
                        "old-text": forward ? "" : deletedText,
                        "new-text": forward ? spacing : ""
                    }]
                });
            applyResults(r, editor);
        }
    })
}

function applyResults(r: ResultOptions, editor: vscode.TextEditor) {
    if (r.success) {
        editor.edit(editBuilder => {
            r.edits.forEach((edit: CFEdit) => {
                const start = new vscode.Position(edit.start.line, edit.start.character),
                    end = new vscode.Position(edit.end.line, edit.end.character);
                editBuilder.replace(new vscode.Range(start, end), edit.text);
            });
        }, { undoStopAfter: true, undoStopBefore: false }).then((_onFulfilled: boolean) => {
            const newPosition = new vscode.Position(r.line, r.character);
            editor.selections = [new vscode.Selection(newPosition, newPosition)];
        });
    }
    else {
        vscode.window.showErrorMessage("Calva Formatter Error: " + (r.error ? r.error.message : r["error-msg"]));
    }
}


export function updateState(editor: vscode.TextEditor) {

}