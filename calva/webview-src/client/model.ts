import { Scanner, Token, ScannerState } from "./clojure-lexer";
import { UndoManager, UndoStep } from "./undo";
import { ReplReadline } from "./readline";
import { LispTokenCursor } from "./token-cursor";

const scanner = new Scanner();

/** A cheesy deep-equal function for matching scanner states. Good enough to compare plain old js objects. */
function equal(x: any, y: any): boolean {
    if(x==y) return true;
    if(x instanceof Array && y instanceof Array) {
        if(x.length == y.length) {
            for(let i = 0; i<x.length; i++)
                if(!equal(x[i], y[i]))
                    return false;
            return true;
        } else
            return false;
    } else if (!(x instanceof Array) && !(y instanceof Array) && x instanceof Object && y instanceof Object) {
        for(let f in x)
            if(!equal(x[f], y[f]))
                return false;
        for(let f in y)
            if(!x.hasOwnProperty(f))
                return false
        return true;
    }
    return false;
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

/** The underlying model for the REPL readline. */
export class LineInputModel {
    /** The input lines. */
    lines: TextLine[] = [new TextLine("", this.getStateForLine(0))];

    /** Lines whose text has changed. */
    changedLines: Set<number> = new Set();

    /** Lines which must be inserted. */
    insertedLines: Set<[number, number]> = new Set();

    /** Lines which must be deleted. */
    deletedLines: Set<[number, number]> = new Set();

    /** Handles undo/redo support */
    undoManager = new UndoManager<ReplReadline>();

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
            max += this.lines[i].text.length + 1;
        return max;
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
                offset -= this.lines[i].text.length+1;
            else
                return [i, offset];
        }
        return [this.lines.length-1, this.lines[this.lines.length-1].text.length]
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
    changeRange(start: number, end: number, text: string, oldSelection?: [number, number], newSelection?: [number, number]) {
        let deletedText = this.recordingUndo ? this.getText(start, end) : "";
        let [startLine, startCol] = this.getRowCol(start);
        let [endLine, endCol] = this.getRowCol(end);
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

        if(startLine != endLine)
            this.deleteLines(startLine+1, endLine-startLine - (replaceLines.length-1));

        if(replaceLines.length == 1) {
            // trivial single line edit
            items.push(new TextLine(left + replaceLines[0] + right, state));
            this.changedLines.add(startLine);
        } else {
            // multi line edit.
            items.push(new TextLine(left + replaceLines[0], state));
            for(let i=1; i<replaceLines.length-1; i++)
                items.push(new TextLine(replaceLines[i], scanner.state));
            items.push(new TextLine(replaceLines[replaceLines.length-1] + right, scanner.state))
            this.insertLines(startLine+1, replaceLines.length-1 - (endLine-startLine))
            for(let i=1; i<items.length; i++)
                this.changedLines.add(startLine+i);
            this.markDirty(startLine+1);
        }

        // now splice in our edited lines
        this.lines.splice(startLine, endLine-startLine+1, ...items);
        this.markDirty(startLine);

        if(this.recordingUndo) {
            this.undoManager.addUndoStep(new EditorUndoStep("Edit", start, text, deletedText, oldSelection, newSelection))
        }
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
            max += this.lines[i].text.length + 1;
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

/**
 * An Editor UndoStep.
 * 
 * All Editor Undo steps contain the position of the cursor before and after the edit.
 */
class EditorUndoStep extends UndoStep<ReplReadline> {
    constructor(public name: string, public start: number, public insertedText: string, public deletedText: string, public oldSelection?: [number, number], public newSelection?: [number, number]) {
        super();
    }

    undo(c: ReplReadline) {
        c.model.changeRange(this.start, this.start+this.insertedText.length, this.deletedText);
        if(this.oldSelection)
            [c.selectionStart, c.selectionEnd] = this.oldSelection;
    }

    redo(c: ReplReadline) {
        c.model.changeRange(this.start, this.start+this.deletedText.length, this.insertedText);
        if(this.newSelection)
            [c.selectionStart, c.selectionEnd] = this.newSelection;
    }

    coalesce(step: EditorUndoStep) {
        if(this.deletedText === ""  && step.deletedText === "" && this.insertedText !== "" && step.insertedText !== "") {
            if(this.start + this.insertedText.length == step.start) {
                this.insertedText += step.insertedText;
                this.newSelection = step.newSelection;
                return true;
            }
        } else if(this.deletedText !== "" && step.deletedText !== "" && this.insertedText === "" && step.insertedText === "") {
            // repeated delete key
            if(this.start == step.start) {
                this.deletedText += step.deletedText;
                this.newSelection = step.newSelection;
                return true;
            }

            // repeated backspace key
            if(this.start - step.deletedText.length == step.start) {
                this.start = step.start;
                this.deletedText = step.deletedText + this.deletedText;
                this.newSelection = step.newSelection;
                return true;
            }            
        }
        return false;
    }
}
