import { Scanner, Token, ScannerState } from './clojure-lexer';
import { LispTokenCursor } from './token-cursor';
import { deepEqual as equal } from '../util/object';
import { isNumber, isUndefined } from 'lodash';
import { TextDocument, Selection } from 'vscode';
import _ = require('lodash');

let scanner: Scanner;

export function initScanner(maxLength: number) {
  scanner = new Scanner(maxLength);
}

/**
 * @param text The text to look in for the end of line seq.
 * @returns The first end of line sequence found in TEXT, if any.
 */
export function getFirstEol(text: string) {
  return text.match(/\r\n|\n/g)?.[0];
}

export class TextLine {
  tokens: Token[] = [];
  text: string;
  endState: ScannerState;

  constructor(text: string, public startState: ScannerState) {
    this.text = text;
    this.tokens = scanner.processLine(text, startState);
    this.endState = { ...scanner.state };
  }

  processLine(oldState: any) {
    this.startState = { ...oldState };
    this.tokens = scanner.processLine(this.text, oldState);
    this.endState = { ...scanner.state };
  }
}

export type ModelEditFunction = 'insertString' | 'changeRange' | 'deleteRange';
export type ModelEditArgs<T extends ModelEditFunction> = T extends 'insertString'
  ? Parameters<LineInputModel['insertString']>
  : T extends 'changeRange'
  ? Parameters<LineInputModel['changeRange']>
  : T extends 'deleteRange'
  ? Parameters<LineInputModel['deleteRange']>
  : never;

export class ModelEdit<T extends ModelEditFunction> {
  constructor(public editFn: T, public args: Readonly<ModelEditArgs<T>>) {}
}

/**
 * An undirected range representing a cursor/selection in a document.
 * Is a tuple of [start, end] where each is an offset.
 * It is a selection if `start` != `end`, otherwise, it's a cursor.
 * 'Undirected' here means the first element, `start`, will always be the leftmost position,
 * even if the selection is in reverse.
 */
export type ModelEditRange = [start: number, end: number];

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
  private _start: number;
  private _end: number;
  private _isReversed: boolean;

  constructor(anchor: number, active?: number, start?: number, end?: number, isReversed?: boolean);
  constructor(selection: Selection, doc: TextDocument);
  constructor(
    anchorOrSelection: number | Selection,
    activeOrDoc?: number | TextDocument,
    start?: number,
    end?: number,
    isReversed?: boolean
  ) {
    if (isNumber(anchorOrSelection)) {
      const anchor = anchorOrSelection;
      this._anchor = anchor;
      if (activeOrDoc !== undefined && isNumber(activeOrDoc)) {
        this._active = activeOrDoc;
      } else {
        this._active = anchor;
      }
      const _isReversed = isReversed ?? this._anchor > this._active;
      this._isReversed = _isReversed;
      this._start = start ?? Math.min(anchor, this._active);
      this._end = end ?? Math.max(anchor, this._active);
    } else {
      const { active, anchor, start, end, isReversed } = anchorOrSelection;
      const doc = activeOrDoc as TextDocument;
      this._active = doc.offsetAt(active);
      this._anchor = doc.offsetAt(anchor);
      this._start = doc.offsetAt(start);
      this._end = doc.offsetAt(end);
      this._isReversed = isReversed;
    }
  }

  private _updateDirection() {
    this._start = Math.min(this._anchor, this._active);
    this._end = Math.max(this._anchor, this._active);
    this._isReversed = this._active < this._anchor;
  }

  get anchor() {
    return this._anchor;
  }

  set anchor(v: number) {
    this._anchor = v;
    this._updateDirection();
  }

  get active() {
    return this._active;
  }

  set active(v: number) {
    this._active = v;
    this._updateDirection();
  }

  get start() {
    this._updateDirection();
    return this._start;
  }

  get end() {
    this._updateDirection();
    return this._end;
  }

  get isCursor() {
    return this.anchor === this.active;
  }

  get isSelection() {
    return this.anchor !== this.active;
  }

  get isReversed() {
    this._updateDirection();
    return this._isReversed;
  }

  set isReversed(isReversed: boolean) {
    this._isReversed = isReversed;
    if (this._isReversed) {
      this._start = this._active;
      this._end = this._anchor;
    } else {
      this._start = this._anchor;
      this._end = this._active;
    }
  }

  get distance() {
    return this._end - this._start;
  }

  clone() {
    return new ModelEditSelection(this._anchor, this._active);
  }

  /**
   * Returns a simple 2-item tuple representing the selection/cursor's range.
   * Loses directionality, if needed, use `asDirectedRange`.
   */
  get asRange(): ModelEditRange {
    return [this.start, this.end];
  }

  /**
   * Same as `ModelEditSelection.asRange` but with the leftmost item being the anchor position, and the rightmost item
   * being the active position. This way, you can tell if it's reversed by checking if the leftmost item is greater
   * than the rightmost item.
   */
  get asDirectedRange() {
    return [this.anchor, this.active] as [anchor: number, active: number];
  }

  /**
   * Mutates itself!
   * Very basic, offsets both active/anchor by a positive or negative number lol, with no attempt at clamping.
   *
   * Returns self for convenience
   * @param offset number
   */
  reposition(offset: number) {
    this.active += offset;
    this.anchor += offset;

    this._updateDirection();

    return this;
  }

  static isSameRange(a: ModelEditSelection, b: ModelEditSelection) {
    return _.isEqual(a?.asRange, b?.asRange);
  }

  static isSameSelection(a: ModelEditSelection, b: ModelEditSelection) {
    return _.isEqual(a?.asDirectedRange, b?.asDirectedRange);
  }

  static containsRange(container: ModelEditSelection, containee: ModelEditSelection) {
    if (containee && container) {
      const containsStart = containee.start >= container.start && containee.start <= container.end;
      const containsEnd = containee.end >= container.start && containee.end <= container.end;
      return containsStart && containsEnd;
    }
  }
}

export type ModelEditOptions = {
  undoStopBefore?: boolean;
  formatDepth?: number;
  skipFormat?: boolean;
  selections?: ModelEditSelection[];
};

export interface EditableModel {
  readonly lineEndingLength: number;
  readonly lineEnding: string;

  /**
   * Performs a model edit batch.
   * For some EditableModel's these are performed as one atomic set of edits.
   * @param edits
   */
  edit: (edits: ModelEdit<ModelEditFunction>[], options: ModelEditOptions) => Thenable<boolean>;

  getText: (start: number, end: number, mustBeWithin?: boolean) => string;
  getLineText: (line: number) => string;
  getOffsetForLine: (line: number) => number;
  getTokenCursor: (offset: number, previous?: boolean) => LispTokenCursor;
}

export interface EditableDocument {
  selections: ModelEditSelection[];
  model: EditableModel;
  /**
   * Selection history stack for grow/shrink selection operations.
   * Is a 2d array to represent multiple cursors/selections at each grow/shrink step,
   * with the first Selection of each inner array being the primar and possibly only cursor.
   */
  selectionsStack: ModelEditSelection[][];
  getTokenCursor: (offset?: number, previous?: boolean) => LispTokenCursor;
  insertString: (text: string) => void;
  getSelectionText: () => string;
  delete: () => Thenable<boolean>;
  backspace: () => Thenable<boolean>;
}

/** The underlying model for the REPL readline. */
export class LineInputModel implements EditableModel {
  /** How many characters in the line endings of the text of this model? */
  constructor(readonly lineEndingLength: number = 1, private document?: EditableDocument) {}

  get lineEnding() {
    return this.lineEndingLength === 1 ? '\n' : '\r\n';
  }

  /** The input lines. */
  lines: TextLine[] = [new TextLine('', this.getStateForLine(0))];

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
    const delta = inserted - deleted;

    this.dirtyLines = this.dirtyLines
      .filter((x) => x < start || x >= start + deleted)
      .map((x) => (x >= start ? x + delta : x));

    this.changedLines = new Set(
      Array.from(this.changedLines)
        .map((x) => {
          if (x > start && x < start + deleted) {
            return null;
          }
          if (x >= start) {
            return x + delta;
          }
          return x;
        })
        .filter((x) => x !== null)
    );

    this.insertedLines = new Set(
      Array.from(this.insertedLines)
        .map((x): [number, number] => {
          const [a, b] = x;
          if (a > start && a < start + deleted) {
            return null;
          }
          if (a >= start) {
            return [a + delta, b];
          }
          return [a, b];
        })
        .filter((x) => x !== null)
    );

    this.deletedLines = new Set(
      Array.from(this.deletedLines)
        .map((x): [number, number] => {
          const [a, b] = x;
          if (a > start && a < start + deleted) {
            return null;
          }
          if (a >= start) {
            return [a + delta, b];
          }
          return [a, b];
        })
        .filter((x) => x !== null)
    );
  }

  private deleteLines(start: number, count: number) {
    if (count == 0) {
      return;
    }
    this.updateLines(start, count, 0);
    this.deletedLines.add([start, count]);
  }

  private insertLines(start: number, count: number) {
    this.updateLines(start, 0, count);
    this.insertedLines.add([start, count]);
  }

  /**
   * Mark a line as needing to be re-lexed.
   *
   * @param idx the index of the line which needs re-lexing (0-based)
   */
  private markDirty(idx: number) {
    if (idx >= 0 && idx < this.lines.length && this.dirtyLines.indexOf(idx) == -1) {
      this.dirtyLines.push(idx);
    }
  }

  /**
   * Re-lexes all lines marked dirty, cascading onto the lines below if the end state for this line has
   * changed.
   */
  flushChanges() {
    if (!this.dirtyLines.length) {
      return;
    }
    const seen = new Set<number>();
    this.dirtyLines.sort();
    while (this.dirtyLines.length) {
      let nextIdx = this.dirtyLines.shift();
      if (seen.has(nextIdx)) {
        continue;
      } // already processed.
      let prevState = this.getStateForLine(nextIdx);
      do {
        seen.add(nextIdx);
        this.changedLines.add(nextIdx);
        this.lines[nextIdx].processLine(prevState);
        prevState = this.lines[nextIdx].endState;
      } while (this.lines[++nextIdx] && !equal(this.lines[nextIdx].startState, prevState));
    }
  }

  /**
   * Returns the character offset in the model to the start of a given line.
   *
   * @param line the line who's offset will be returned.
   */
  getOffsetForLine(line: number) {
    let max = 0;
    for (let i = 0; i < line; i++) {
      max += this.lines[i].text.length + this.lineEndingLength;
    }
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
    if (start == end) {
      return '';
    }
    if (mustBeWithin && (Math.min(start, end) < 0 || Math.max(start, end) > this.maxOffset)) {
      return '';
    }
    const st = this.getRowCol(Math.min(start, end));
    const en = this.getRowCol(Math.max(start, end));

    const lines: string[] = [];
    if (st[0] == en[0]) {
      lines[0] = this.lines[st[0]].text.substring(st[1], en[1]);
    } else {
      lines[0] = this.lines[st[0]].text.substring(st[1]);
    }
    for (let i = st[0] + 1; i < en[0]; i++) {
      lines.push(this.lines[i].text);
    }
    if (st[0] != en[0]) {
      lines.push(this.lines[en[0]].text.substring(0, en[1]));
    }
    return lines.join('\n');
  }

  /**
   * Returns the row and column for a given text offset in this model.
   */
  getRowCol(offset: number): [number, number] {
    for (let i = 0; i < this.lines.length; i++) {
      if (offset > this.lines[i].text.length) {
        offset -= this.lines[i].text.length + this.lineEndingLength;
      } else {
        return [i, offset];
      }
    }
    return [this.lines.length - 1, this.lines[this.lines.length - 1].text.length];
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
      for (let i = column; i >= 0; i--) {
        if (stopChars.includes(text[i])) {
          break;
        }
        startIdx = i;
      }
      for (let j = column; j < text.length; j++) {
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
    return line == 0 ? { inString: false } : { ...this.lines[line - 1].endState };
  }

  /**
   * Performs a model edit batch.
   * Doesn't need to be atomic in the LineInputModel.
   * @param edits
   */
  edit(edits: ModelEdit<ModelEditFunction>[], options: ModelEditOptions): Thenable<boolean> {
    return new Promise((resolve, reject) => {
      for (const edit of edits) {
        switch (edit.editFn) {
          case 'insertString': {
            const fn = this.insertString;
            this.insertString(...(edit.args.slice(0, 4) as Parameters<typeof fn>));
            break;
          }
          case 'changeRange': {
            const fn = this.changeRange;
            this.changeRange(...(edit.args.slice(0, 5) as Parameters<typeof fn>));
            break;
          }
          case 'deleteRange': {
            const fn = this.deleteRange;
            this.deleteRange(...(edit.args.slice(0, 5) as Parameters<typeof fn>));
            break;
          }
          default:
            break;
        }
      }
      if (this.document && options.selections) {
        this.document.selections = options.selections;
      }
      resolve(true);
    });
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
  private changeRange(
    start: number,
    end: number,
    text: string,
    oldSelection?: [number, number],
    newSelection?: [number, number]
  ) {
    const t1 = new Date();

    const startPos = Math.min(start, end);
    const endPos = Math.max(start, end);
    const deletedText = this.recordingUndo ? this.getText(startPos, endPos) : '';
    const [startLine, startCol] = this.getRowCol(startPos);
    const [endLine, endCol] = this.getRowCol(endPos);
    // extract the lines we will replace
    const replaceLines = text.split(/\r\n|\n/);

    // the left side of the line unaffected by the edit.
    const left = this.lines[startLine].text.substr(0, startCol);

    // the right side of the line unaffected by the edit.
    const right = this.lines[endLine].text.substr(endCol);

    const items: TextLine[] = [];

    // initialize the lexer state - the first line is definitely not in a string, otherwise copy the
    // end state of the previous line before the edit
    const state = this.getStateForLine(startLine);
    const currentLength = endLine - startLine + 1;

    if (replaceLines.length == 1) {
      // trivial single line edit
      items.push(new TextLine(left + replaceLines[0] + right, state));
    } else {
      // multi line edit.
      items.push(new TextLine(left + replaceLines[0], state));
      for (let i = 1; i < replaceLines.length - 1; i++) {
        items.push(new TextLine(replaceLines[i], scanner.state));
      }
      items.push(new TextLine(replaceLines[replaceLines.length - 1] + right, scanner.state));
    }

    if (currentLength > replaceLines.length) {
      // shrink the lines
      this.deleteLines(startLine + replaceLines.length, currentLength - replaceLines.length);
    } else if (currentLength < replaceLines.length) {
      // extend the lines
      this.insertLines(endLine, replaceLines.length - currentLength);
    }

    // now splice in our edited lines
    this.lines.splice(startLine, endLine - startLine + 1, ...items);

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
  insertString(
    offset: number,
    text: string,
    oldSelection?: [number, number],
    newSelection?: [number, number]
  ): number {
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
  deleteRange(
    offset: number,
    count: number,
    oldSelection?: [number, number],
    newSelection?: [number, number]
  ) {
    this.changeRange(offset, offset + count, '', oldSelection, newSelection);
  }

  /** Return the offset of the last character in this model. */
  get maxOffset() {
    let max = 0;
    for (let i = 0; i < this.lines.length; i++) {
      max += this.lines[i].text.length + this.lineEndingLength;
    }
    return max - 1;
  }

  public getTokenCursor(offset: number, previous: boolean = false) {
    const [row, col] = this.getRowCol(offset);
    const line = this.lines[row];
    let lastIndex = 0;
    if (line) {
      for (let i = 0; i < line.tokens.length; i++) {
        const tk = line.tokens[i];
        if (previous ? tk.offset > col : tk.offset > col) {
          return new LispTokenCursor(this, row, previous ? Math.max(0, lastIndex - 1) : lastIndex);
        }
        lastIndex = i;
      }
      return new LispTokenCursor(this, row, line.tokens.length - 1);
    } else {
      throw new Error('Unable to get token cursor for LineInputModel!');
    }
  }
}

export class StringDocument implements EditableDocument {
  constructor(contents?: string) {
    const eol = contents ? getFirstEol(contents) : null;

    this.model = new LineInputModel(eol ? eol.length : 1, this);
    if (contents) {
      this.insertString(contents);
    }
    this.selections = [];
  }
  // Selections in real vscode Documents are "deduped" - there cannot be two
  // cursors in the same location.
  private _selections: ModelEditSelection[] = [];

  /**
   * Mimic vscode's selection deduping.
   * - Remove nils
   * - Remove duplicate ranges
   * - Remove selections contained in another, ie, prefer larger selections
   */
  set selections(newSelections: ModelEditSelection[]) {
    const uniqueSelections = _(newSelections)
      // drop nils
      .compact()
      // simple deduping of duplicate ranges
      .uniqWith(ModelEditSelection.isSameRange)
      // "dedupe" any selections contained in another
      .reject(
        (s, _i, sels) =>
          _(sels)
            .without(s) // selection always contains self, so drop self
            .compact() // drop nils from `without`
            .some((b) => ModelEditSelection.containsRange(b, s)) // always prefer the larger selection
      )
      .value();

    this._selections = uniqueSelections;
  }

  get selections() {
    return this._selections;
  }

  model: LineInputModel;

  selectionsStack: ModelEditSelection[][] = [];

  getTokenCursor(offset?: number, previous?: boolean): LispTokenCursor {
    if (isUndefined(offset)) {
      throw new Error('Expected a cursor for StringDocument!');
    }

    return this.model.getTokenCursor(offset);
  }

  insertString(text: string) {
    this.model.insertString(0, text);
    initScanner(scanner.maxLength);
  }

  getSelectionText: () => string;

  delete() {
    const p = this.selections[0].anchor;
    return this.model.edit([new ModelEdit('deleteRange', [p, 1])], {
      selections: [new ModelEditSelection(p)],
    });
  }

  backspace() {
    const p = this.selections[0].anchor;
    return this.model.edit([new ModelEdit('deleteRange', [p - 1, 1])], {
      selections: [new ModelEditSelection(p - 1)],
    });
  }
}
