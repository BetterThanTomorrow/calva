import { Scanner, Token, ScannerState } from "./clojure-lexer";
import { LispTokenCursor } from "./token-cursor";
import { deepEqual as equal } from "../util/object";
import * as parinfer from '../calva-fmt/src/infer';

let scanner: Scanner;

export function initScanner(maxLength: number) {
    scanner = new Scanner(maxLength);
}

export class TextLine {
    tokens: Token[] = [];
    text: string;
    endState: ScannerState;
    constructor(text: string, public startState: ScannerState) {
        this.text = text;
        this.tokens = scanner.processLine(text)
        this.endState = {...scanner.state};
    }

    processLine(oldState: any) {
        this.startState = { ...oldState}
        this.tokens = scanner.processLine(this.text, oldState)
        this.endState = {...scanner.state};
    }
}

export type ModelEditFunction = 'insertString' | 'changeRange' | 'deleteRange';

export class ModelEdit {
    constructor(public editFn: ModelEditFunction, public args: any[]) { }
}

/**
 * Naming notes for Model Selections:
 * `anchor`, the start of a selection, can be left or right of, or the same as the end of the selection (active)
 * `active`, the end of a selection, where the caret is, can be left or right of, or the same as the start of the selection   (anchor)
 * `left`, the smallest of `anchor` and `active`
 * `right`, the largest of `anchor` and `active`
 * `backward`, movement towards the left
 * `forward`, movement towards the right
 * `up`, movement out of lists
 * `down`, movement into lists
 *
 * This will be in line with vscode when it comes to anchor/active, but introduce our own terminology  for the span of the selection. It will also keep the tradition of paredit with backward/forward and up/down.
 */

export class ModelEditSelection {
    private _anchor: number;
    private _active: number;

    constructor(anchor: number, active?: number) {
        this._anchor = anchor;
        if (active !== undefined) {
            this._active = active;
        } else {
            this._active = anchor;
        }
    }

    get anchor() {
        return this._anchor;
    }

    set anchor(v: number) {
        this._anchor = v;
    }

    get active() {
        return this._active;
    }

    set active(v: number) {
        this._active = v;
    }

    clone() {
        return new ModelEditSelection(this._anchor, this._active);
    }
}


export type ModelEditOptions = {
    undoStopBefore?: boolean,
    formatDepth?: number,
    skipFormat?: boolean,
    parensInferred?: boolean,
    rangeFormatted?: boolean,
    selection?: ModelEditSelection
};

export interface EditableModel {
    readonly lineEndingLength: number;

    /**
     * Performs a model edit batch.
     * For some EditableModel's these are performed as one atomic set of edits.
     * @param edits
     */
    edit: (edits: ModelEdit[], options: ModelEditOptions) => Thenable<boolean>;
    parinferReadiness: parinfer.ParinferReadiness,
    isWritable: boolean;
    getText: (start: number, end: number, mustBeWithin?: boolean) => string;
    getLineText: (line: number) => string;
    getOffsetForLine: (line: number) => number;
    getTokenCursor: (offset: number, previous?: boolean) => LispTokenCursor;
}

export interface EditableDocument {
    readonly selectionLeft: number,
    readonly selectionRight: number,
    selection: ModelEditSelection,
    model: EditableModel,
    selectionStack: ModelEditSelection[],
    getTokenCursor: (offset?: number, previous?: boolean) => LispTokenCursor,
    insertString: (text: string) => void,
    getSelectionText: () => string,
    delete: () => Thenable<boolean>,
    backspace: () => Thenable<boolean>;
}

/** The underlying model for the REPL readline. */
export class LineInputModel implements EditableModel {
    /** How many characters in the line endings of the text of this model? */
    constructor(readonly lineEndingLength: number = 1, private document?: EditableDocument) { }

    isWritable = true;
    
    parinferReadiness: parinfer.ParinferReadiness = {
        isIndentationHealthy: false,
        isStructureHealthy: false
    }
    performInferParens = true;

    /** The input lines. */
    lines: TextLine[] = [new TextLine("", this.getStateForLine(0))];

    /** Lines whose text has changed. */
    changedLines: Set<number> = new Set();

    /** Lines which must be inserted. */
    insertedLines: Set<[number, number]> = new Set();

    /** Lines which must be deleted. */
    deletedLines: Set<[number, number]> = new Set();

    /** When set, insertString and deleteRange will be added to the undo history. */
    recordingUndo: boolean = false;

    /** Lines which must be re-lexed. */
    dirtyLines: number[] = [];

    private updateLines(start: number, deleted: number, inserted: number) {
        let delta = inserted-deleted;

        this.dirtyLines = this.dirtyLines.filter(x => x < start || x >= start+deleted)
                                          .map(x => x >= start ? x + delta : x);


        this.changedLines = new Set(Array.from(this.changedLines).map(x => {
            if(x > start && x < start + deleted)
                return null;
            if(x >= start)
                return x+delta;
            return x;
        }).filter(x => x !== null))

        this.insertedLines = new Set(Array.from(this.insertedLines).map((x):[number, number] => {
            let [a, b] = x;
            if(a > start && a < start + deleted)
                return null;
            if(a >= start)
                return [a+delta, b];
            return [a, b]
        }).filter(x => x !== null))

        this.deletedLines = new Set(Array.from(this.deletedLines).map((x):[number, number] => {
            let [a, b] = x;
            if(a > start && a < start + deleted)
                return null;
            if(a >= start)
                return [a+delta, b];
            return [a, b]
        }).filter(x => x !== null))
    }

    private deleteLines(start: number, count: number) {
        if(count == 0)
            return;
        this.updateLines(start, count, 0);
        this.deletedLines.add([start, count])
    }

    private insertLines(start: number, count: number) {
        this.updateLines(start, 0, count);
        this.insertedLines.add([start, count])
    }

    /**
     * Mark a line as needing to be re-lexed.
     *
     * @param idx the index of the line which needs re-lexing (0-based)
    */
    private markDirty(idx: number) {
        if(idx >= 0 && idx < this.lines.length && this.dirtyLines.indexOf(idx) == -1)
            this.dirtyLines.push(idx);
    }

    /**
     * Re-lexes all lines marked dirty, cascading onto the lines below if the end state for this line has
     * changed.
     */
    flushChanges() {
        if(!this.dirtyLines.length)
            return;
        let seen = new Set<number>();
        this.dirtyLines.sort();
        while(this.dirtyLines.length) {
            let nextIdx = this.dirtyLines.shift();
            if(seen.has(nextIdx))
                continue; // already processed.
            let prevState = this.getStateForLine(nextIdx);
            do {
                seen.add(nextIdx);
                this.changedLines.add(nextIdx);
                this.lines[nextIdx].processLine(prevState);
                prevState = this.lines[nextIdx].endState;

            } while(this.lines[++nextIdx] && !(equal(this.lines[nextIdx].startState, prevState)))
        }
    }

    /**
     * Returns the character offset in the model to the start of a given line.
     *
     * @param line the line who's offset will be returned.
     */
    getOffsetForLine(line: number) {
        let max = 0;
        for(let i=0; i<line; i++)
            max += this.lines[i].text.length + this.lineEndingLength;
        return max;
    }

    /**
     * Returns the text of the given line
     *
     * @param line the line to get the text of
     */
    getLineText(line: number): string {
        return this.lines[line].text;
    }

    /**
     * Returns the text between start and end as a string. These may be in any order.
     *
     * @param start the start offset in the text range
     * @param end the end offset in the text range
     * @param mustBeWithin if the start or end are outside the document, returns ""
     */
    getText(start: number, end: number, mustBeWithin = false): string {
        if(start == end)
            return "";
        if(mustBeWithin && (Math.min(start, end) < 0 || Math.max(start, end) > this.maxOffset))
            return "";
        let st = this.getRowCol(Math.min(start, end));
        let en = this.getRowCol(Math.max(start, end));

        let lines = [];
        if(st[0] == en[0])
            lines[0] = this.lines[st[0]].text.substring(st[1], en[1])
        else
            lines[0] = this.lines[st[0]].text.substring(st[1])
        for(let i=st[0]+1; i<en[0]; i++)
            lines.push(this.lines[i].text);
        if(st[0] != en[0])
            lines.push(this.lines[en[0]].text.substring(0, en[1]));
        return lines.join('\n');
    }

    /**
     * Returns the row and column for a given text offset in this model.
     */
    getRowCol(offset: number): [number, number] {
        for(let i=0; i<this.lines.length; i++) {
            if(offset > this.lines[i].text.length)
                offset -= this.lines[i].text.length + this.lineEndingLength;
            else
                return [i, offset];
        }
        return [this.lines.length-1, this.lines[this.lines.length-1].text.length]
    }

    /**
     * Returns the start and end offset of the word found for the given offset in
     * the model.
     *
     * @param offset The offset in the line model.
     * @returns [number, number] The start and the index of the word in the model.
     */
    getWordSelection(offset: number): [number, number] {

        const stopChars = [' ', '"', ';', '.', '(', ')', '[', ']', '{', '}', '\t', '\n', '\r'],
              [row, column] = this.getRowCol(offset),
              text = this.lines[row].text;

        if (text && text.length > 1 && column < text.length && column >= 0) {

            if (stopChars.includes(text[column])) {
                return [offset, offset];
            }
            let stopIdx = column;
            let startIdx = column;
            for(let i = column; i >= 0; i--) {
                if (stopChars.includes(text[i])) {
                    break;
                }
                startIdx = i;
            }
            for(let j = column; j < text.length; j++) {
                if (stopChars.includes(text[j])) {
                    break;
                }
                stopIdx = j;
            }
            return [offset - (column - startIdx), offset + (stopIdx - column) + 1];
        }
        return [offset, offset];
    }

    /**
     * Returns the initial lexer state for a given line.
     * Line 0 is always { inString: false }, all lines below are equivalent to their previous line's startState.
     *
     * @param line the line to retrieve the lexer state.
     */
    private getStateForLine(line: number): ScannerState {
        return line == 0 ? { inString: false, } : { ... this.lines[line-1].endState };
    }

    /**
     * Performs a model edit batch.
     * Doesn't need to be atomic in the LineInputModel.
     * @param edits
     */
    edit(edits: ModelEdit[], options: ModelEditOptions): Thenable<boolean> {
        return new Promise((resolve, reject) => {
            for (const edit of edits) {
                switch (edit.editFn) {
                    case 'insertString':
                        this.insertString.apply(this, edit.args);
                        break;
                    case 'changeRange':
                        this.changeRange.apply(this, edit.args);
                        break;
                    case 'deleteRange':
                        this.deleteRange.apply(this, edit.args);
                        break;
                    default:
                        break;
                }
            }
            if (this.document && options.selection) {
                this.document.selection = options.selection;
            }
            resolve(true);
        })
    }

    /**
     * Changes the model. Deletes any text between `start` and `end`, and the inserts `text`.
     *
     * If provided, `oldSelection` and `newSelection` are used to manage the cursor positioning for undo support.
     *
     * @param start the start offset in the range to delete
     * @param end the end offset in the range to delete
     * @param text the new text to insert
     * @param oldSelection the old selection
     * @param newSelection the new selection
     */
    private changeRange(start: number, end: number, text: string, oldSelection?: [number, number], newSelection?: [number, number]) {
        const t1 = new Date();

        let startPos = Math.min(start, end);
        let endPos = Math.max(start, end);
        let deletedText = this.recordingUndo ? this.getText(startPos, endPos) : "";
        let [startLine, startCol] = this.getRowCol(startPos);
        let [endLine, endCol] = this.getRowCol(endPos);
        // extract the lines we will replace
        let replaceLines = text.split(/\r\n|\n/);

        // the left side of the line unaffected by the edit.
        let left = this.lines[startLine].text.substr(0, startCol);

        // the right side of the line unaffected by the edit.
        let right = this.lines[endLine].text.substr(endCol);

        let items: TextLine[] = [];

        // initialize the lexer state - the first line is definitely not in a string, otherwise copy the
        // end state of the previous line before the edit
        let state = this.getStateForLine(startLine)
        let currentLength = (endLine - startLine) + 1;

        if(replaceLines.length == 1) {
            // trivial single line edit
            items.push(new TextLine(left + replaceLines[0] + right, state));
        } else {
            // multi line edit.
            items.push(new TextLine(left + replaceLines[0], state));
            for(let i=1; i<replaceLines.length-1; i++)
                items.push(new TextLine(replaceLines[i], scanner.state));
            items.push(new TextLine(replaceLines[replaceLines.length-1] + right, scanner.state))
        }

        if(currentLength > replaceLines.length) {
            // shrink the lines
             this.deleteLines(startLine + replaceLines.length, currentLength - replaceLines.length);
         } else if(currentLength < replaceLines.length) {
             // extend the lines
             this.insertLines(endLine, replaceLines.length - currentLength);
         }

        // now splice in our edited lines
        this.lines.splice(startLine, endLine-startLine+1, ...items);

        // set the changed and dirty marker
        for (let i = 0; i < items.length; i++) {
            this.changedLines.add(startLine + i);
            this.markDirty(startLine + i);
        }

        // console.log("Parsing took: ", new Date().valueOf() - t1.valueOf());
    }

    /**
     * Inserts a string at the given position in the document.
     *
     * If recordingUndo is set, an UndoStep is inserted into the undoManager, which will record the original
     * cursor position.
     *
     * @param offset the offset to insert at
     * @param text the text to insert
     * @param oldCursor the [row,col] of the cursor at the start of the operation
     */
    insertString(offset: number, text: string, oldSelection?: [number, number], newSelection?: [number, number]): number {
        this.changeRange(offset, offset, text, oldSelection, newSelection);
        return text.length;
    }

    /**
     * Deletes count characters starting at offset from the document.
     * If recordingUndo is set, adds an undoStep, using oldCursor and newCursor.
     *
     * @param offset the offset to delete from
     * @param count the number of characters to delete
     * @param oldCursor the cursor at the start of the operation
     * @param newCursor the cursor at the end of the operation
     */
    deleteRange(offset: number, count: number, oldSelection?: [number, number], newSelection?: [number, number]) {
        this.changeRange(offset, offset+count, "", oldSelection, newSelection);
    }

    /** Return the offset of the last character in this model. */
    get maxOffset() {
        let max = 0;
        for(let i=0; i<this.lines.length; i++)
            max += this.lines[i].text.length + this.lineEndingLength;
        return max-1;
    }

    public getTokenCursor(offset: number, previous: boolean = false) {
        let [row, col] = this.getRowCol(offset);
        let line = this.lines[row]
        let lastIndex = 0;
        if(line) {
            for(let i=0; i<line.tokens.length; i++) {
                let tk = line.tokens[i];
                if(previous ? tk.offset > col : tk.offset > col)
                    return new LispTokenCursor(this, row, previous ? Math.max(0, lastIndex-1) : lastIndex);
                lastIndex = i;
            }
            return new LispTokenCursor(this, row, line.tokens.length-1);
        }
    }
}


export class StringDocument implements EditableDocument {
    constructor(contents: string) {
        this.insertString(contents);
    }

    selectionLeft: number;
    selectionRight: number;

    get selection() {
        return new ModelEditSelection(this.selectionLeft, this.selectionRight);
    }

    set selection(sel: ModelEditSelection) {
        this.selectionLeft = sel.anchor;
        this.selectionRight = sel.active;
    }

    model: LineInputModel = new LineInputModel(1, this);

    selectionStack: ModelEditSelection[] = [];

    getTokenCursor(offset?: number, previous?: boolean): LispTokenCursor {
        return this.model.getTokenCursor(offset);
    };

    insertString(text: string) {
        this.model.insertString(0, text);
    };

    getSelectionText: () => string;

    delete() {
        const p = this.selectionLeft;
        return this.model.edit([
            new ModelEdit('deleteRange', [p, 1])
        ], { selection: new ModelEditSelection(p) });
    };

    backspace() {
        const p = this.selectionLeft;
        return this.model.edit([
            new ModelEdit('deleteRange', [p - 1, 1])
        ], { selection: new ModelEditSelection(p - 1) });
    };
}