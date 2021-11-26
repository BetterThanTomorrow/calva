import * as docModel from '../../cursor-doc/model';
import * as calvaLib from '../../../out/cljs-lib/cljs-lib';

export interface Edit {
    edit: string,
    start: { line: number, character: number },
    end: { line: number, character: number },
    text?: string
}

interface Results {
    success: boolean,
    //"new-text": string,
    edits?: Edit[],
    line?: number,
    character?: number,
    "error-msg"?: string
}

function rowColToOffset(document: docModel.EditableDocument, row: number, col: number) {
    const lineOffset = document.model.getOffsetForLine(row);
    return lineOffset + col;
}

export async function inferParens(document: docModel.EditableDocument): Promise<Results> {
    console.count(`inferParens`);
    const [row, col] = document.getTokenCursor().rowCol;
    const currentText = document.model.getText(0, Infinity);
    const r: Results = calvaLib.inferParens({
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
        await document.model.edit(modelEdits, {
            selection: new docModel.ModelEditSelection(newP),
            skipFormat: true,
            undoStopBefore: false,
            parensInferred: true
        });
        return {
            success: true
        }
    }
    return {
        success: r.success,
        "error-msg": r['error-msg'],
        line: r.line,
        character: r.character
    };
}

export async function inferIndents(document: docModel.EditableDocument): Promise<Results> {
    const r: Results = inferIndentsResults(document);
    if (r.edits && r.edits?.length > 0) {
        const modelEdits = r.edits?.map(edit => {
            const start = rowColToOffset(document, edit.start.line, edit.start.character);
            const end = rowColToOffset(document, edit.end.line, edit.end.character);
            return new docModel.ModelEdit('changeRange', [start, end, edit.text]);
        });
        const rP = rowColToOffset(document, r.line, r.character);
        await document.model.edit(modelEdits, {
            selection: new docModel.ModelEditSelection(rP),
            skipFormat: true,
            undoStopBefore: true,
            parensInferred: true
        });
        return {
            success: true
        }
    }
    return {
        success: r.success,
        "error-msg": r['error-msg'],
        line: r.line,
        character: r.character
    };
}

export function inferIndentsResults(document: docModel.EditableDocument): Results {
    const [row, col] = document.getTokenCursor().rowCol;
    const currentText = document.model.getText(0, Infinity);
    const r: Results = calvaLib.inferIndents({
        "text": currentText,
        "line": row,
        "character": col,
        "previous-line": row,
        "previous-character": col
    });
    return r;
}

export interface ParinferReadiness {
    isStructureHealthy: boolean;
    isIndentationHealthy: boolean;
}

export function getParinferReadiness(document: docModel.EditableDocument): ParinferReadiness {
    const r: Results = inferIndentsResults(document);
    return {
        isStructureHealthy: r.success,
        isIndentationHealthy: r.success ? r.edits.length === 0 : false
    }
}
