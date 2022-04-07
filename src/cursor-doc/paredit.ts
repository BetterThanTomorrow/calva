import { isEqual, last, pick, property, clone, isBoolean, orderBy } from 'lodash';
import { validPair } from './clojure-lexer';
import {
  EditableDocument,
  ModelEdit,
  ModelEditSelection,
  ModelEditResult,
  ModelEditFunctionArgs,
} from './model';
import { LispTokenCursor } from './token-cursor';
import { replaceAt } from '../util/array';

// NB: doc.model.edit returns a Thenable, so that the vscode Editor can compose commands.
// But don't put such chains in this module because that won't work in the repl-console.
// In the repl-console, compose commands just by performing them in succession, making sure
// you provide selections, old and new.

// TODO: Implement all movement and selection commands here, instead of composing them
//       exactly the same way in the editor and in the repl-window.
//       Example: paredit.moveToRangeRight(this.readline, paredit.forwardSexpRange(this.readline))
//                => paredit.moveForwardSexp(this.readline)

export function killRange(
  doc: EditableDocument,
  range: [number, number],
  start = doc.selections[0].anchor,
  end = doc.selections[0].active
) {
  const [left, right] = [Math.min(...range), Math.max(...range)];
  void doc.model.edit([new ModelEdit('deleteRange', [left, right - left, [start, end]])], {
    selections: [new ModelEditSelection(left)],
  });
}

export function moveToRangeLeft(doc: EditableDocument, ranges: Array<[number, number]>) {
  // doc.selections = [new ModelEditSelection(Math.min(range[0], range[1]))];
  doc.selections = ranges.map((range) => new ModelEditSelection(Math.min(range[0], range[1])));
}

export function moveToRangeRight(doc: EditableDocument, ranges: Array<[number, number]>) {
  doc.selections = ranges.map((range) => new ModelEditSelection(Math.max(range[0], range[1])));
}

export function selectRange(doc: EditableDocument, ranges: Array<[number, number]>) {
  growSelectionStack(doc, ranges);
}

export function selectRangeForward(
  doc: EditableDocument,
  // selections: Array<[number, number]> = doc.selections.map(s => ([s.anchor, s.active]))
  ranges: Array<[number, number]> = doc.selections.map((s) => [s.anchor, s.active])
) {
  growSelectionStack(
    doc,
    ranges.map((range, index) => {
      const selectionLeft = doc.selections[index].anchor;
      const rangeRight = Math.max(range[0], range[1]);
      return [selectionLeft, rangeRight];
    })
  );
}

export function selectRangeBackward(doc: EditableDocument, ranges: Array<[number, number]>) {
  growSelectionStack(
    doc,
    ranges.map((range, index) => {
      const selectionRight = doc.selections[index].anchor;
      const rangeLeft = Math.min(range[0], range[1]);
      return [selectionRight, rangeLeft];
    })
  );
}

// TODO: could prob use ModelEditSelection semantics for `end` versus checking for active >= anchor
export function selectForwardSexp(doc: EditableDocument) {
  const ranges = doc.selections.map((selection) => {
    const rangeFn =
      selection.active >= selection.anchor
        ? forwardSexpRange
        : (doc: EditableDocument) => forwardSexpRange(doc, selection.active, true);
    return rangeFn(doc, selection.start);
  });
  selectRangeForward(doc, ranges);
}

// TODO: could prob use ModelEditSelection semantics for `end` versus checking for active >= anchor
export function selectRight(doc: EditableDocument) {
  const ranges = doc.selections.map((selection) => {
    const rangeFn =
      selection.active >= selection.anchor
        ? (doc) => forwardHybridSexpRange(doc, selection.end)
        : (doc: EditableDocument) => forwardHybridSexpRange(doc, selection.active, true);
    return rangeFn(doc);
  });
  selectRangeForward(doc, ranges);
}

export function selectForwardSexpOrUp(doc: EditableDocument) {
  const ranges = doc.selections.map((selection) => {
    const rangeFn =
      selection.active >= selection.anchor
        ? (doc) => forwardSexpOrUpRange(doc, selection.end)
        : (doc: EditableDocument) => forwardSexpOrUpRange(doc, selection.active, true);
    return rangeFn(doc);
  });
  selectRangeForward(doc, ranges);
}

export function selectBackwardSexp(doc: EditableDocument) {
  const ranges = doc.selections.map((selection) => {
    const rangeFn =
      selection.active <= selection.anchor
        ? backwardSexpRange
        : (doc: EditableDocument) => backwardSexpRange(doc, selection.active, false);
    return rangeFn(doc, selection.start);
  });
  selectRangeBackward(doc, ranges);
}

export function selectForwardDownSexp(doc: EditableDocument) {
  const ranges = doc.selections.map((selection) => {
    const rangeFn =
      selection.active >= selection.anchor
        ? (doc: EditableDocument) => rangeToForwardDownList(doc, selection.active, true)
        : (doc: EditableDocument) => rangeToForwardDownList(doc, selection.active, true);
    return rangeFn(doc);
  });
  selectRangeForward(doc, ranges);
}

export function selectBackwardDownSexp(doc: EditableDocument) {
  selectRangeBackward(
    doc,
    doc.selections.map((selection) => rangeToBackwardDownList(doc, selection.start))
  );
}

export function selectForwardUpSexp(doc: EditableDocument) {
  selectRangeForward(
    doc,
    doc.selections.map((selection) => rangeToForwardUpList(doc, selection.end))
  );
}

export function selectBackwardUpSexp(doc: EditableDocument) {
  const ranges = doc.selections.map((selection) => {
    const rangeFn =
      selection.active <= selection.anchor
        ? (doc: EditableDocument) => rangeToBackwardUpList(doc, selection.active, false)
        : (doc: EditableDocument) => rangeToBackwardUpList(doc, selection.active, false);
    return rangeFn(doc);
  });
  selectRangeBackward(doc, ranges);
}

export function selectBackwardSexpOrUp(doc: EditableDocument) {
  const ranges = doc.selections.map((selection) => {
    const rangeFn =
      selection.active <= selection.anchor
        ? (doc: EditableDocument) => backwardSexpOrUpRange(doc, selection.active, false)
        : (doc: EditableDocument) => backwardSexpOrUpRange(doc, selection.active, false);
    return rangeFn(doc);
  });
  selectRangeBackward(doc, ranges);
}

export function selectCloseList(doc: EditableDocument) {
  selectRangeForward(
    doc,
    doc.selections.map((selection) => rangeToForwardList(doc, selection.end))
  );
}

export function selectOpenList(doc: EditableDocument) {
  selectRangeBackward(
    doc,
    doc.selections.map((selection) => rangeToBackwardList(doc, selection.start))
  );
}

/**
 * Gets the range for the ”current” top level form
 * @see ListTokenCursor.rangeForDefun
 */
export function rangeForDefun(
  doc: EditableDocument,
  offset: number = doc.selections[0].active,
  commentCreatesTopLevel = true
): [number, number] {
  const cursor = doc.getTokenCursor(offset);
  return cursor.rangeForDefun(offset, commentCreatesTopLevel);
}

/**
 * Required : If the cursor can move up and out of an sexp, it must
 * Never : If the cursor is at the inner limit of an sexp, it may not escape
 * WhenAtLimit : If the cursor is at the inner limit of an sexp, it may move up and out
 */
enum GoUpSexpOption {
  Required,
  Never,
  WhenAtLimit,
}

/**
 * Return a modified selection range on doc. Moves the right limit around sexps, potentially moving up.
 */
function _forwardSexpRange(
  doc: EditableDocument,
  offsets = doc.selections.map((s) => s.end),
  goUpSexp: GoUpSexpOption,
  goPastWhitespace = false
): Array<[number, number]> {
  return offsets.map((offset) => {
    const cursor = doc.getTokenCursor(offset);

    if (goUpSexp == GoUpSexpOption.Never || goUpSexp == GoUpSexpOption.WhenAtLimit) {
      // Normalize our position by scooting to the beginning of the closest sexp
      cursor.forwardWhitespace();

      if (cursor.forwardSexp(true, true)) {
        if (goPastWhitespace) {
          cursor.forwardWhitespace();
        }
        return [offset, cursor.offsetStart];
      }
    }

    if (goUpSexp == GoUpSexpOption.Required || goUpSexp == GoUpSexpOption.WhenAtLimit) {
      cursor.forwardList();
      if (cursor.upList()) {
        if (goPastWhitespace) {
          cursor.forwardWhitespace();
        }
        return [offset, cursor.offsetStart];
      }
    }
    return [offset, offset];
  });
}

/**
 * Return a modified selection range on doc. Moves the left limit around sexps, potentially moving up.
 */
function _backwardSexpRange(
  doc: EditableDocument,
  offsets: number[] = doc.selections.map((s) => s.start),
  goUpSexp: GoUpSexpOption,
  goPastWhitespace = false
): Array<[number, number]> {
  return offsets.map((offset) => {
    const cursor = doc.getTokenCursor(offset);

    if (goUpSexp == GoUpSexpOption.Never || goUpSexp == GoUpSexpOption.WhenAtLimit) {
      if (!cursor.isWhiteSpace() && cursor.offsetStart < offset) {
        // This is because cursor.backwardSexp() can't move backwards when "on" the first sexp inside a list
        // TODO: Try to fix this in LispTokenCursor instead.
        cursor.forwardSexp();
      }
      cursor.backwardWhitespace();

      if (cursor.backwardSexp(true, true)) {
        if (goPastWhitespace) {
          cursor.backwardWhitespace();
        }
        return [cursor.offsetStart, offset];
      }
    }

    if (goUpSexp == GoUpSexpOption.Required || goUpSexp == GoUpSexpOption.WhenAtLimit) {
      cursor.backwardList();
      if (cursor.backwardUpList()) {
        cursor.forwardSexp(true, true);
        cursor.backwardSexp(true, true);
        if (goPastWhitespace) {
          cursor.backwardWhitespace();
        }
        return [cursor.offsetStart, offset];
      }
    }

    return [offset, offset];
  });
}

export function forwardSexpRange(
  doc: EditableDocument,
  offsets?: number[],
  goPastWhitespace?: boolean
): Array<[number, number]>;
export function forwardSexpRange(
  doc: EditableDocument,
  offset?: number,
  goPastWhitespace?: boolean
): [number, number];
export function forwardSexpRange(
  doc: EditableDocument,
  oneOrMoreOffsets: number[] | number = doc.selections.map((s) => s.end),
  goPastWhitespace = false
): Array<[number, number]> | [number, number] {
  const offsets = Array.isArray(oneOrMoreOffsets) ? oneOrMoreOffsets : [oneOrMoreOffsets];
  const ranges = _forwardSexpRange(doc, offsets, GoUpSexpOption.Never, goPastWhitespace);
  return Array.isArray(oneOrMoreOffsets) ? ranges : ranges[0];
}

export function backwardSexpRange(
  doc: EditableDocument,
  offsets?: number[],
  goPastWhitespace?: boolean
): Array<[number, number]>;
export function backwardSexpRange(
  doc: EditableDocument,
  offset?: number,
  goPastWhitespace?: boolean
): [number, number];
export function backwardSexpRange(
  doc: EditableDocument,
  oneOrMoreOffsets: number[] | number = doc.selections.map((s) => s.start),
  goPastWhitespace = false
): Array<[number, number]> | [number, number] {
  const offsets = Array.isArray(oneOrMoreOffsets) ? oneOrMoreOffsets : [oneOrMoreOffsets];
  const ranges = _backwardSexpRange(doc, offsets, GoUpSexpOption.Never, goPastWhitespace);
  return Array.isArray(oneOrMoreOffsets) ? ranges : ranges[0];
}

export function forwardListRange(
  doc: EditableDocument,
  start: number = doc.selections[0].active
): [number, number] {
  const cursor = doc.getTokenCursor(start);
  cursor.forwardList();
  return [start, cursor.offsetStart];
}

export function backwardListRange(
  doc: EditableDocument,
  start: number = doc.selections[0].active
): [number, number] {
  const cursor = doc.getTokenCursor(start);
  cursor.backwardList();
  return [cursor.offsetStart, start];
}

/**
 * Aims to find the end of the current form (list|vector|map|set|string etc)
 * When there is a newline before the end of the current form either:
 *  - Return the end of the nearest form to the right of the cursor location if one exists
 *  - Returns the newline's offset if no form exists
 *
 * This function's output range is needed to implement features similar to paredit's
 * killRight or smartparens' sp-kill-hybrid-sexp.
 *
 * @param doc
 * @param offset
 * @param goPastWhitespace
 * @returns [number, number]
 */
export function forwardHybridSexpRange(
  doc: EditableDocument,
  offsets?: number[],
  goPastWhitespace?: boolean
): Array<[number, number]>;
export function forwardHybridSexpRange(
  doc: EditableDocument,
  offset?: number,
  goPastWhitespace?: boolean
): [number, number];
export function forwardHybridSexpRange(
  doc: EditableDocument,
  // offset = Math.max(doc.selections.anchor, doc.selections.active),
  // offset?: number = doc.selections[0].end,
  // selections: ModelEditSelection[] = doc.selections,
  offsets: number | number[] = doc.selections.map((s) => s.end),
  goPastWhitespace = false
): [number, number] | Array<[number, number]> {
  if (isNumber(offsets)) {
    offsets = [offsets];
  }

  const ranges = offsets.map<[number, number]>((offset) => {
    // const { end: offset } = selection;

    let cursor = doc.getTokenCursor(offset);
    if (cursor.getToken().type === 'open') {
      const [forwarded] = forwardSexpRange(doc, [offset]);
      return forwarded;
    } else if (cursor.getToken().type === 'close') {
      return [offset, offset];
    }

    const currentLineText = doc.model.getLineText(cursor.line);
    const lineStart = doc.model.getOffsetForLine(cursor.line);
    const currentLineNewlineOffset = lineStart + currentLineText.length;
    const remainderLineText = doc.model.getText(offset, currentLineNewlineOffset + 1);

    cursor.forwardList(); // move to the end of the current form
    const currentFormEndToken = cursor.getToken();
    // when we've advanced the cursor but start is behind us then go to the end
    // happens when in a clojure comment i.e:  ;; ----
    const cursorOffsetEnd = cursor.offsetStart <= offset ? cursor.offsetEnd : cursor.offsetStart;
    const text = doc.model.getText(offset, cursorOffsetEnd);
    let hasNewline = text.indexOf('\n') > -1;
    let end = cursorOffsetEnd;

    // Want the min of closing token or newline
    // After moving forward, the cursor is not yet at the end of the current line,
    // and it is not a close token. So we include the newline
    // because what forms are here extend beyond the end of the current line
    if (currentLineNewlineOffset > cursor.offsetEnd && currentFormEndToken.type != 'close') {
      hasNewline = true;
      end = currentLineNewlineOffset;
    }

    if (remainderLineText === '' || remainderLineText === '\n') {
      end = currentLineNewlineOffset + doc.model.lineEndingLength;
    } else if (hasNewline) {
      // Try to find the first open token to the right of the document's cursor location if any
      let nearestOpenTokenOffset = -1;

      // Start at the newline.
      // Work backwards to find the smallest open token offset
      // greater than the document's cursor location if any
      cursor = doc.getTokenCursor(currentLineNewlineOffset);
      while (cursor.offsetStart > offset) {
        while (cursor.backwardSexp()) {
          // move backward until the cursor cannot move backward anymore
        }
        if (cursor.offsetStart > offset) {
          nearestOpenTokenOffset = cursor.offsetStart;
          cursor = doc.getTokenCursor(cursor.offsetStart - 1);
        }
      }

      if (nearestOpenTokenOffset > 0) {
        cursor = doc.getTokenCursor(nearestOpenTokenOffset);
        cursor.forwardList();
        end = cursor.offsetEnd; // include the closing token
      } else {
        // no open tokens found so the end is the newline
        end = currentLineNewlineOffset;
      }
    }
    return [offset, end];
  });

  if (isNumber(offsets)) {
    return ranges[0];
  } else {
    return ranges;
  }
}

export function rangeToForwardUpList(
  doc: EditableDocument,
  // offset: number = Math.max(doc.selections.anchor, doc.selections.active),
  offset: number = doc.selections[0].end,
  goPastWhitespace = false
): [number, number] {
  return _forwardSexpRange(doc, [offset], GoUpSexpOption.Required, goPastWhitespace)[0];
}

export function rangeToBackwardUpList(
  doc: EditableDocument,
  // offset: number = Math.min(doc.selections.anchor, doc.selections.active),
  offset: number = doc.selections[0].start,
  goPastWhitespace = false
): [number, number] {
  return _backwardSexpRange(doc, [offset], GoUpSexpOption.Required, goPastWhitespace)[0];
}

export function forwardSexpOrUpRange(
  doc: EditableDocument,
  offsets?: number[],
  goPastWhitespace?: boolean
): Array<[number, number]>;
export function forwardSexpOrUpRange(
  doc: EditableDocument,
  offset?: number,
  goPastWhitespace?: boolean
): [number, number];
export function forwardSexpOrUpRange(
  doc: EditableDocument,
  oneOrMoreOffsets: number[] | number = doc.selections.map((s) => s.end),
  goPastWhitespace = false
): Array<[number, number]> | [number, number] {
  const offsets = isNumber(oneOrMoreOffsets) ? [oneOrMoreOffsets] : oneOrMoreOffsets;
  const ranges = _forwardSexpRange(doc, offsets, GoUpSexpOption.WhenAtLimit, goPastWhitespace);
  return isNumber(oneOrMoreOffsets) ? ranges[0] : ranges;
}

export function backwardSexpOrUpRange(
  doc: EditableDocument,
  offsets?: number[],
  goPastWhitespace?: boolean
): Array<[number, number]>;
export function backwardSexpOrUpRange(
  doc: EditableDocument,
  offset?: number,
  goPastWhitespace?: boolean
): [number, number];
export function backwardSexpOrUpRange(
  doc: EditableDocument,
  oneOrMoreOffsets: number[] | number = doc.selections.map((s) => s.start),
  goPastWhitespace = false
): Array<[number, number]> | [number, number] {
  const offsets = isNumber(oneOrMoreOffsets) ? [oneOrMoreOffsets] : oneOrMoreOffsets;
  const ranges = _backwardSexpRange(doc, offsets, GoUpSexpOption.WhenAtLimit, goPastWhitespace);
  return isNumber(oneOrMoreOffsets) ? ranges[0] : ranges;
}

export function rangeToForwardDownList(
  doc: EditableDocument,
  // offset: number = Math.max(doc.selections.anchor, doc.selections.active),
  offset: number = doc.selections[0].end,
  goPastWhitespace = false
): [number, number] {
  const cursor = doc.getTokenCursor(offset);
  if (cursor.downListSkippingMeta()) {
    if (goPastWhitespace) {
      cursor.forwardWhitespace();
    }
    return [offset, cursor.offsetStart];
  } else {
    return [offset, offset];
  }
}

export function rangeToBackwardDownList(
  doc: EditableDocument,
  // offsets: number[] = Math.min(doc.selections.anchor, doc.selections.active),
  offset: number = doc.selections[0].start,
  goPastWhitespace = false
): [number, number] {
  const cursor = doc.getTokenCursor(offset);
  do {
    cursor.backwardWhitespace();
    if (cursor.getPrevToken().type === 'close') {
      break;
    }
  } while (cursor.backwardSexp());
  if (cursor.backwardDownList()) {
    if (goPastWhitespace) {
      cursor.backwardWhitespace();
    }
    return [cursor.offsetStart, offset];
  } else {
    return [offset, offset];
  }
}

export function rangeToForwardList(
  doc: EditableDocument,
  // offset: number = Math.max(doc.selections.anchor, doc.selections.active)
  offset: number = doc.selections[0].end
): [number, number] {
  const cursor = doc.getTokenCursor(offset);
  if (cursor.forwardList()) {
    return [offset, cursor.offsetStart];
  } else {
    return [offset, offset];
  }
}

export function rangeToBackwardList(
  doc: EditableDocument,
  // offset: number = Math.min(doc.selections.anchor, doc.selections.active)
  offset: number = doc.selections[0].start
): [number, number] {
  const cursor = doc.getTokenCursor(offset);
  if (cursor.backwardList()) {
    return [cursor.offsetStart, offset];
  } else {
    return [offset, offset];
  }
}

// TODO: test
export function wrapSexpr(
  doc: EditableDocument,
  open: string,
  close: string,
  // _start: number, // = doc.selections.anchor,
  // _end: number, // = doc.selections.active,
  options = { skipFormat: false }
): void {
  return doc.selections.forEach((sel) => {
    const { start, end } = sel;
    const cursor = doc.getTokenCursor(end);
    if (cursor.withinString() && open == '"') {
      open = close = '\\"';
    }
    if (start == end) {
      // No selection
      const currentFormRange = cursor.rangeForCurrentForm(start);
      if (currentFormRange) {
        const range = currentFormRange;
        void doc.model.edit(
          [
            new ModelEdit('insertString', [range[1], close]),
            new ModelEdit('insertString', [
              range[0],
              open,
              // [end, end],
              // [start + open.length, start + open.length],
            ]),
          ],
          {
            selections: [new ModelEditSelection(start + open.length)],
            skipFormat: options.skipFormat,
          }
        );
      }
    } else {
      // there is a selection
      const range = [Math.min(start, end), Math.max(start, end)];
      void doc.model.edit(
        [
          new ModelEdit('insertString', [range[1], close]),
          new ModelEdit('insertString', [range[0], open]),
        ],
        {
          selections: [new ModelEditSelection(start + open.length)],
          skipFormat: options.skipFormat,
        }
      );
    }
  });
}

// TODO: test
export function rewrapSexpr(
  doc: EditableDocument,
  open: string,
  close: string
  // _start: number, // = doc.selections.anchor,
  // _end: number // = doc.selections.active
) {
  doc.selections.forEach((sel) => {
    const { start, end } = sel;
    const cursor = doc.getTokenCursor(end);
    if (cursor.backwardList()) {
      const openStart = cursor.offsetStart - 1,
        openEnd = cursor.offsetStart;
      if (cursor.forwardList()) {
        const closeStart = cursor.offsetStart,
          closeEnd = cursor.offsetEnd;
        void doc.model.edit(
          [
            new ModelEdit('changeRange', [closeStart, closeEnd, close]),
            new ModelEdit('changeRange', [openStart, openEnd, open]),
          ],
          { selections: [new ModelEditSelection(end)] }
        );
      }
    }
  });
}

// TODO: test
export function splitSexp(doc: EditableDocument) {
  const edits = [],
    selections = clone(doc.selections);
  doc.selections.forEach((selection, index) => {
    const { start, end } = selection;
    const cursor = doc.getTokenCursor(start);
    if (!cursor.withinString() && !(cursor.isWhiteSpace() || cursor.previousIsWhiteSpace())) {
      cursor.forwardWhitespace();
    }
    const splitPos = cursor.withinString() ? start : cursor.offsetStart;
    if (cursor.backwardList()) {
      const open = cursor.getPrevToken().raw;
      if (cursor.forwardList()) {
        const close = cursor.getToken().raw;
        edits.push(new ModelEdit('changeRange', [splitPos, splitPos, `${close}${open}`]));
        selections[index] = new ModelEditSelection(splitPos + 1);
      }
    }
  });
  return doc.model.edit(edits, {
    selections,
  });
}

/**
 * If `start` is between two strings or two lists of the same type: join them. Otherwise do nothing.
 * @param doc
 * @param start
 */
// TODO: test
export function joinSexp(doc: EditableDocument): Thenable<ModelEditResult> {
  const edits = [],
    selections = clone(doc.selections);
  doc.selections.forEach((selection, index) => {
    const { start, end } = selection;

    const cursor = doc.getTokenCursor(start);
    cursor.backwardWhitespace();
    const prevToken = cursor.getPrevToken(),
      prevEnd = cursor.offsetStart;
    if (['close', 'str-end', 'str'].includes(prevToken.type)) {
      cursor.forwardWhitespace();
      const nextToken = cursor.getToken(),
        nextStart = cursor.offsetStart;
      if (validPair(nextToken.raw[0], prevToken.raw[prevToken.raw.length - 1])) {
        //
        edits.push(
          new ModelEdit('changeRange', [
            prevEnd - 1,
            nextStart + 1,
            prevToken.type === 'close' ? ' ' : '',
            // [start, start],
            // [prevEnd, prevEnd],
          ])
        );
        selections[index] = new ModelEditSelection(prevEnd);
      }
    }
  });
  return doc.model.edit(edits, { selections, formatDepth: 2 });
}

export function spliceSexp(
  doc: EditableDocument,
  // start: number = doc.selections.active,
  undoStopBefore = true
): Thenable<ModelEditResult> {
  const edits = [],
    selections = clone(doc.selections);
  doc.selections.forEach((selection, index) => {
    const { start, end } = selection;
    const cursor = doc.getTokenCursor(start);
    // TODO: this should unwrap the string, not the enclosing list.
    cursor.backwardList();
    const open = cursor.getPrevToken();
    const beginning = cursor.offsetStart;
    if (open.type == 'open') {
      cursor.forwardList();
      const close = cursor.getToken();
      const end = cursor.offsetStart;
      if (close.type == 'close' && validPair(open.raw, close.raw)) {
        edits.push(
          new ModelEdit('changeRange', [end, end + close.raw.length, '']),
          new ModelEdit('changeRange', [beginning - open.raw.length, beginning, ''])
        );
        selections[index] = new ModelEditSelection(start - 1);
      }
    }
  });

  return doc.model.edit(edits, { undoStopBefore, selections });
}

export function killBackwardList(
  doc: EditableDocument,
  [start, end]: [number, number]
): Thenable<ModelEditResult> {
  return doc.model.edit(
    [new ModelEdit('changeRange', [start, end, '', [end, end], [start, start]])],
    {
      selections: [new ModelEditSelection(start)],
    }
  );
}

export function killForwardList(
  doc: EditableDocument,
  [start, end]: [number, number]
): Thenable<ModelEditResult> {
  const cursor = doc.getTokenCursor(start);
  const inComment =
    (cursor.getToken().type == 'comment' && start > cursor.offsetStart) ||
    cursor.getPrevToken().type == 'comment';
  return doc.model.edit(
    [
      new ModelEdit('changeRange', [
        start,
        end,
        inComment ? '\n' : '',
        [start, start],
        [start, start],
      ]),
    ],
    { selections: [new ModelEditSelection(start)] }
  );
}

// FIXME: check if this forEach solution works vs map into modelEdit batch
export function forwardSlurpSexp(doc: EditableDocument) {
  const startOffsets: number[] = doc.selections.map(property('active'));
  startOffsets.forEach((offset) => {
    const extraOpts = { formatDepth: 1 };

    _forwardSlurpSexpSingle(doc, offset, extraOpts);
  });
}

export function _forwardSlurpSexpSingle(
  doc: EditableDocument,
  start: number,
  extraOpts = { formatDepth: 1 }
) {
  const cursor = doc.getTokenCursor(start);
  cursor.forwardList();
  if (cursor.getToken().type == 'close') {
    const currentCloseOffset = cursor.offsetStart;
    const close = cursor.getToken().raw;
    const wsInsideCursor = cursor.clone();
    wsInsideCursor.backwardWhitespace(false);
    const wsStartOffset = wsInsideCursor.offsetStart;
    cursor.upList();
    const wsOutSideCursor = cursor.clone();
    // check if we're about to hit the end of our current scope
    if (cursor.forwardSexp(true, true)) {
      wsOutSideCursor.forwardWhitespace(false);
      const wsEndOffset = wsOutSideCursor.offsetStart;
      const newCloseOffset = cursor.offsetStart;
      const replacedText = doc.model.getText(wsStartOffset, wsEndOffset);
      const changeArgs: ModelEditFunctionArgs<'changeRange'> =
        replacedText.indexOf('\n') >= 0
          ? [currentCloseOffset, currentCloseOffset + close.length, '']
          : [wsStartOffset, wsEndOffset, ' '];
      void doc.model.edit(
        [
          new ModelEdit('insertString', [newCloseOffset, close]),
          new ModelEdit('changeRange', changeArgs),
        ],
        {
          ...{
            undoStopBefore: true,
          },
          ...extraOpts,
        }
      );
    } else {
      // the
      const formatDepth = extraOpts['formatDepth'] ? extraOpts['formatDepth'] : 1;
      _forwardSlurpSexpSingle(doc, cursor.offsetStart, {
        formatDepth: formatDepth + 1,
      });
    }
  }
}

// FIXME: check if this forEach solution works vs map into modelEdit batch
export function backwardSlurpSexp(doc: EditableDocument) {
  doc.selections.forEach((selection) => {
    const extraOpts = { formatDepth: 1 };
    _backwardSlurpSexpSingle(doc, selection.active, extraOpts);
  });
}

export function _backwardSlurpSexpSingle(doc: EditableDocument, start: number, extraOpts = {}) {
  const cursor = doc.getTokenCursor(start);
  cursor.backwardList();
  const tk = cursor.getPrevToken();
  if (tk.type == 'open') {
    const offset = cursor.clone().previous().offsetStart;
    const open = cursor.getPrevToken().raw;
    cursor.previous();
    cursor.backwardSexp(true, true);
    cursor.forwardWhitespace(false);
    if (offset !== cursor.offsetStart) {
      void doc.model.edit(
        [
          new ModelEdit('deleteRange', [offset, tk.raw.length]),
          new ModelEdit('changeRange', [cursor.offsetStart, cursor.offsetStart, open]),
        ],
        {
          ...{
            undoStopBefore: true,
          },
          ...extraOpts,
        }
      );
    } else {
      const formatDepth = extraOpts['formatDepth'] ? extraOpts['formatDepth'] : 1;
      _backwardSlurpSexpSingle(doc, cursor.offsetStart, {
        formatDepth: formatDepth + 1,
      });
    }
  }
}

export function forwardBarfSexp(doc: EditableDocument) {
  const edits = [],
    selections = clone(doc.selections);
  doc.selections.forEach((selection, index) => {
    const { start, end } = selection;
    const cursor = doc.getTokenCursor(start);
    cursor.forwardList();
    if (cursor.getToken().type == 'close') {
      const offset = cursor.offsetStart,
        close = cursor.getToken().raw;
      cursor.backwardSexp(true, true);
      cursor.backwardWhitespace();
      edits.push(
        new ModelEdit('deleteRange', [offset, close.length]),
        new ModelEdit('insertString', [cursor.offsetStart, close])
      );
      if (start >= cursor.offsetStart) {
        selections[index] = new ModelEditSelection(cursor.offsetStart);
      } else {
        selections[index] = selection;
      }
    }
  });
  void doc.model.edit(edits, { selections, formatDepth: 2 });
}

export function backwardBarfSexp(doc: EditableDocument) {
  const edits = [],
    selections = clone(doc.selections);

  doc.selections.forEach((sel, index) => {
    const { start, end } = sel;
    const cursor = doc.getTokenCursor(start);
    cursor.backwardList();
    const tk = cursor.getPrevToken();
    if (tk.type == 'open') {
      cursor.previous();
      const offset = cursor.offsetStart;
      const close = cursor.getToken().raw;
      cursor.next();
      cursor.forwardSexp(true, true);
      cursor.forwardWhitespace(false);

      edits.push(
        new ModelEdit('changeRange', [cursor.offsetStart, cursor.offsetStart, close]),
        new ModelEdit('deleteRange', [offset, tk.raw.length])
      );

      if (start <= cursor.offsetStart) {
        selections[index] = new ModelEditSelection(cursor.offsetStart);
      }
    }
  });

  void doc.model.edit(edits, { selections, formatDepth: 2 });
}

// FIXME: open() is defined and tested but is never used or referenced?
export function open(
  doc: EditableDocument,
  open: string,
  close: string,
  start: number = doc.selections[0].active
) {
  const [cs, ce] = [doc.selections[0].anchor, doc.selections[0].active];
  doc.insertString(open + doc.getSelectionTexts() + close);
  if (cs != ce) {
    // TODO(multi-cursor): make multi cursor compat?
    doc.selections = replaceAt(
      doc.selections,
      0,
      new ModelEditSelection(cs + open.length, ce + open.length)
    );
  } else {
    // TODO(multi-cursor): make multi cursor compat?
    doc.selections = replaceAt(doc.selections, 0, new ModelEditSelection(start + open.length));
  }
}

// TODO: docIsBalanced() needs testing
function docIsBalanced(
  doc: EditableDocument
  // start: number = doc.selections.active
): boolean {
  const cursor = doc.getTokenCursor(0);
  while (cursor.forwardSexp(true, true, true)) {
    // move forward until the cursor cannot move forward anymore
  }
  cursor.forwardWhitespace(true);
  return cursor.atEnd();
}

export function close(
  doc: EditableDocument,
  close: string,
  startOffsets: number[] = doc.selections.map(property('active'))
) {
  const edits = [],
    selections = clone(doc.selections);

  startOffsets.forEach((start, index) => {
    const cursor = doc.getTokenCursor(start);
    const inString = cursor.withinString();
    cursor.forwardWhitespace(false);
    if (cursor.getToken().raw === close) {
      selections[index] = new ModelEditSelection(cursor.offsetEnd);
    } else {
      if (!inString && docIsBalanced(doc)) {
        // Do nothing when there is balance
      } else {
        edits.push(new ModelEdit('insertString', [start, close]));
        selections[index] = new ModelEditSelection(start + close.length);
      }
    }
  });
  return doc.model.edit(edits, {
    selections,
  });
}

export function backspace(
  doc: EditableDocument
  // _start: number, // = doc.selections.anchor,
  // _end: number // = doc.selections.active
  // ): Thenable<ModelEditResult> {
): Thenable<boolean[]> {
  // const selections = clone(doc.selections);

  return Promise.all(
    doc.selections.map<Promise<readonly [boolean | 'backspace', ModelEditSelection, number?]>>(
      async (selection, index) => {
        const { start, end } = selection;

        if (start != end) {
          // const res = await doc.backspace();

          // return res.selections[0];
          // return [res.success, res.selections[0]];
          return ['backspace', selection, index] as const;
        } else {
          const cursor = doc.getTokenCursor(start);
          const nextToken = cursor.getToken();
          const p = start;
          const prevToken =
            p > cursor.offsetStart && !['open', 'close'].includes(nextToken.type)
              ? nextToken
              : cursor.getPrevToken();
          if (prevToken.type == 'prompt') {
            // return new Promise<boolean>((resolve) => resolve(true));
            // return selection;
            return [true, selection] as const;
          } else if (nextToken.type == 'prompt') {
            // return new Promise<boolean>((resolve) => resolve(true));
            return [true, selection] as const;
            // return selection;
          } else if (doc.model.getText(p - 2, p, true) == '\\"') {
            // return doc.model.edit([new ModelEdit('deleteRange', [p - 2, 2])], {
            const sel = new ModelEditSelection(p - 2);
            // selections[index] = sel;
            const res = await doc.model.edit([new ModelEdit('deleteRange', [p - 2, 2])], {
              // selections: [new ModelEditSelection(p - 2)],
              // selections: Object.assign([...selections], {[index]: new ModelEditSelection(p - 2)})
              selections: replaceAt(doc.selections, index, sel),
            });
            // return sel;
            // selections[index] = res.selections[index];
            return [res.success, res.selections[index]] as const;
          } else if (prevToken.type === 'open' && nextToken.type === 'close') {
            // return doc.model.edit(
            const sel = new ModelEditSelection(p - prevToken.raw.length);
            // selections[index] = sel;
            const res = await doc.model.edit(
              [new ModelEdit('deleteRange', [p - prevToken.raw.length, prevToken.raw.length + 1])],
              {
                // selections: [new ModelEditSelection(p - prevToken.raw.length)],
                // selections: Object.assign([...selections], {[index]: new ModelEditSelection(p - prevToken.raw.length)},
                selections: replaceAt(doc.selections, index, sel),
              }
            );
            // selections[index] = res.selections[index];
            return [res.success, res.selections[index]] as const;
          } else {
            if (['open', 'close'].includes(prevToken.type) && docIsBalanced(doc)) {
              // doc.selection = new ModelEditSelection(p - prevToken.raw.length);
              // return new ModelEditSelection(p - prevToken.raw.length);
              // selections[index] = new ModelEditSelection(p - prevToken.raw.length);
              // return new Promise<boolean>((resolve) => resolve(true));
              return [true, new ModelEditSelection(p - prevToken.raw.length)] as const;
            } else {
              // const res = await doc.backspace();
              // selections[index] = res.selections[0];
              // return [res.success, res.selections[0]] as const;
              return ['backspace', selection, index] as const;
            }
          }
        }
      }
    )
  ).then<Array<boolean>>(async (results) => {
    // run native backspace on non edited cursors
    const nativeBackspaceSelections = results
      .filter((result) => result[0] === 'backspace')
      .map((result) => result[1]);
    doc.selections = nativeBackspaceSelections;
    await doc.backspace();
    // set edited selections
    doc.selections.push(...results.filter((r) => r[0] === true).map(([_, sel]) => sel));
    return results.map(([success]) => (success === 'backspace' ? true : success));
  });
}

export async function deleteForward(
  doc: EditableDocument
  // _start: number = doc.selections.anchor,
  // _end: number = doc.selections.active
) {
  const results = await Promise.all(
    doc.selections.map(async (selection, index) => {
      const { start, end } = selection;
      if (start != end) {
        // await doc.delete();
        // return selection;
        return ['delete', selection, index] as const;
      } else {
        const cursor = doc.getTokenCursor(start);
        const prevToken = cursor.getPrevToken();
        const nextToken = cursor.getToken();
        const p = start;
        if (doc.model.getText(p, p + 2, true) == '\\"') {
          const res = await doc.model.edit([new ModelEdit('deleteRange', [p, 2])], {
            selections: replaceAt(doc.selections, index, new ModelEditSelection(p)),
          });
          return [res.success, res.selections[index], index] as const;
        } else if (prevToken.type === 'open' && nextToken.type === 'close') {
          const res = await doc.model.edit(
            [new ModelEdit('deleteRange', [p - prevToken.raw.length, prevToken.raw.length + 1])],
            {
              selections: replaceAt(
                doc.selections,
                index,
                new ModelEditSelection(p - prevToken.raw.length)
              ),
            }
          );
          return [res.success, res.selections[index], index] as const;
        } else {
          if (['open', 'close'].includes(nextToken.type) && docIsBalanced(doc)) {
            // doc.selections = replaceAt(doc.selections, index, new ModelEditSelection(p + 1));
            // return new Promise<boolean>((resolve) => resolve(true));
            return [true, new ModelEditSelection(p + 1), index] as const;
          } else {
            // return doc.delete();
            // return selection;
            return ['delete', selection, index] as const;
          }
        }
      }
    })
  );
  const postCalvaEditSelections = results.filter((r) => isBoolean(r[0]));
  const cursorsNeedingNativeDeletion = results.filter((r) => r[0] === 'delete');
  doc.selections = cursorsNeedingNativeDeletion.map((r) => r[1]);
  await doc.delete();

  doc.selections.push(...postCalvaEditSelections.map((s) => s[1]));
  return results.map((r) => (r[0] === 'delete' ? true : r[0]));
}

// FIXME: stringQuote() is defined and tested but is never used or referenced?
export function stringQuote(
  doc: EditableDocument,
  start: number = doc.selections[0].start,
  end: number = doc.selections[0].end
) {
  if (start != end) {
    doc.insertString('"');
  } else {
    const cursor = doc.getTokenCursor(start);
    if (cursor.withinString()) {
      // inside a string, let's be clever
      if (cursor.getToken().type == 'close') {
        if (doc.model.getText(0, start).endsWith('\\')) {
          void doc.model.edit([new ModelEdit('changeRange', [start, start, '"'])], {
            selections: [new ModelEditSelection(start + 1)],
          });
        } else {
          // close(doc, '"', start);
          // close(doc, '"', replaceAt(doc.selections.map(property('active')), 0, start));
          void close(doc, '"', replaceAt(doc.selections.map(property('active')), 0, start));
        }
      } else {
        if (doc.model.getText(0, start).endsWith('\\')) {
          void doc.model.edit([new ModelEdit('changeRange', [start, start, '"'])], {
            selections: [new ModelEditSelection(start + 1)],
          });
        } else {
          void doc.model.edit([new ModelEdit('changeRange', [start, start, '\\"'])], {
            selections: [new ModelEditSelection(start + 2)],
          });
        }
      }
    } else {
      void doc.model.edit([new ModelEdit('changeRange', [start, start, '""'])], {
        selections: [new ModelEditSelection(start + 1)],
      });
    }
  }
}

/**
 * Given the set of selections in the given document,
 * edit the set of selections therein such that for each selection:
 * the selection expands to encompass just the contents of the form
 * (where this selection or its cursor lies), the entire form itself
 * (including open/close symbols) or the full contents of the form
 * immediately enclosing this one, repeating each time the function is
 * called, for each selection in the doc.
 *
 * (Or in other words, the S-expression powered equivalent to vs-code's
 * built-in Expand Selection/Shrink Selection commands)
 */
export function growSelection(
  doc: EditableDocument
  // start: number = doc.selections.anchor,
  // end: number = doc.selections.active
) {
  const newRanges = doc.selections.map<[number, number]>(({ anchor: start, active: end }) => {
    // init start/end TokenCursors, ascertain emptiness of selection
    const startC = doc.getTokenCursor(start),
      endC = doc.getTokenCursor(end),
      emptySelection = startC.equals(endC);

    // check if selection is empty - means just a cursor
    if (emptySelection) {
      const currentFormRange = startC.rangeForCurrentForm(start);
      // check if there's a form associated with the current cursor
      if (currentFormRange) {
        // growSelectionStack(doc, currentFormRange);
        return currentFormRange;
      }
      // if there's not, do nothing, we will not be expanding this cursor
      return [start, end];
    } else {
      if (startC.getPrevToken().type == 'open' && endC.getToken().type == 'close') {
        startC.backwardList();
        startC.backwardUpList();
        endC.forwardList();
        // growSelectionStack(doc, [startC.offsetStart, endC.offsetEnd]);
        return [startC.offsetStart, startC.offsetEnd];
      } else {
        if (startC.backwardList()) {
          // we are in an sexpr.
          endC.forwardList();
          endC.previous();
        } else {
          if (startC.backwardDownList()) {
            startC.backwardList();
            if (emptySelection) {
              endC.set(startC);
              endC.forwardList();
              endC.next();
            }
            startC.previous();
          } else if (startC.downList()) {
            if (emptySelection) {
              endC.set(startC);
              endC.forwardList();
              endC.next();
            }
            startC.previous();
          }
        }
        // growSelectionStack(doc, [startC.offsetStart, endC.offsetEnd]);
        return [startC.offsetStart, endC.offsetEnd];
      }
    }
  });
  growSelectionStack(doc, newRanges);
}

/**
 * When growing a stack, we want a temporary selection undo/redo history,
 * so to speak, such that each time the growSelection (labelled "Expand Selection")
 * command is invoked, the selection keeps expanding by s-expression level, without
 * "losing" prior selections.
 *
 * Recall that one cannot arbitrarily "Shrink Selection" _without_ such a history stack
 * or outside of the context of a series of "Expand Selection" operations,
 * as there is no way to know to which symbol(s) a user could hypothetically intend on
 * "zooming in" on via selection shrinking.
 *
 * Thus to implement the above, we store a stack of selections (each item in the stack
 * is an array of selection items, one per cursor) and grow or traverse this stack
 * as the user expands or shrinks their selection(s).
 *
 * @param doc EditableDocument
 * @param ranges the new ranges to grow the selection into
 * @returns
 */
export function growSelectionStack(doc: EditableDocument, ranges: Array<[number, number]>) {
  // Check if user has already at least once invoked "Expand Selection":
  if (doc.selectionsStack.length > 0) {
    // User indeed already has a selection set expansion history.
    const prev = last(doc.selectionsStack);
    // Check if the current document selection set DOES NOT match the widest (latest) selection set
    // in the history.
    if (
      !(
        isEqual(doc.selections.map(property('anchor')), prev.map(property('anchor'))) &&
        isEqual(doc.selections.map(property('active')), prev.map(property('active')))
      )
    ) {
      // FIXME(multi-cursor): This means there's some kind of mismatch. Why?
      // Therefore, let's reset the selection set history
      setSelectionStack(doc);

      // Check if the intended new selection set to grow into is already the widest (latest) selection set
      // in the history.
    } else if (
      isEqual(prev.map(property('anchor')), ranges.map(property(0))) &&
      isEqual(prev.map(property('active')), ranges.map(property(1)))
    ) {
      return;
    }
  } else {
    // start a "fresh" selection set expansion history
    // FIXME(multi-cursor): why doesn't this use `setSelectionStack(doc)` from below?
    doc.selectionsStack = [doc.selections];
  }
  doc.selections = ranges.map((range) => new ModelEditSelection(...range));
  doc.selectionsStack.push(doc.selections);
}

// FIXME(multi-cursor): prob needs rethinking
export function shrinkSelection(doc: EditableDocument) {
  if (doc.selectionsStack.length) {
    const latest = doc.selectionsStack.pop();
    if (
      doc.selectionsStack.length &&
      latest.every((selection, index) =>
        isEqual(
          pick(selection, ['anchor, active']),
          pick(doc.selections[index], ['anchor, active'])
        )
      )
    ) {
      doc.selections = last(doc.selectionsStack);
    }
  }
}

export function setSelectionStack(
  doc: EditableDocument,
  selections: ModelEditSelection[][] = [doc.selections]
) {
  doc.selectionsStack = selections;
}

export function raiseSexp(
  doc: EditableDocument
  // start = doc.selections.anchor,
  // end = doc.selections.active
) {
  const edits = [],
    selections = clone(doc.selections);
  doc.selections.forEach((selection, index) => {
    const { start, end } = selection;

    const cursor = doc.getTokenCursor(end);
    const [formStart, formEnd] = cursor.rangeForCurrentForm(start);
    const isCaretTrailing = formEnd - start < start - formStart;
    const startCursor = doc.getTokenCursor(formStart);
    const endCursor = startCursor.clone();
    if (endCursor.forwardSexp()) {
      const raised = doc.model.getText(startCursor.offsetStart, endCursor.offsetStart);
      startCursor.backwardList();
      endCursor.forwardList();
      if (startCursor.getPrevToken().type == 'open') {
        startCursor.previous();
        if (endCursor.getToken().type == 'close') {
          edits.push(
            new ModelEdit('changeRange', [startCursor.offsetStart, endCursor.offsetEnd, raised])
          );
          selections[index] = new ModelEditSelection(
            isCaretTrailing ? startCursor.offsetStart + raised.length : startCursor.offsetStart
          );
        }
      }
    }
  });
  return doc.model.edit(edits, {
    selections,
  });
}

export function convolute(
  doc: EditableDocument
  // start = doc.selections.anchor,
  // end = doc.selections.active
) {
  doc.selections.forEach((selection) => {
    const { start, end } = selection;

    if (start == end) {
      const cursorStart = doc.getTokenCursor(end);
      const cursorEnd = cursorStart.clone();

      if (cursorStart.backwardList()) {
        if (cursorEnd.forwardList()) {
          const head = doc.model.getText(cursorStart.offsetStart, end);
          if (cursorStart.getPrevToken().type == 'open') {
            cursorStart.previous();
            const headStart = cursorStart.clone();

            if (headStart.backwardList() && headStart.backwardUpList()) {
              const headEnd = cursorStart.clone();
              if (headEnd.forwardList() && cursorEnd.getToken().type == 'close') {
                void doc.model.edit(
                  [
                    new ModelEdit('changeRange', [headEnd.offsetEnd, headEnd.offsetEnd, ')']),
                    new ModelEdit('changeRange', [cursorEnd.offsetStart, cursorEnd.offsetEnd, '']),
                    new ModelEdit('changeRange', [cursorStart.offsetStart, end, '']),
                    new ModelEdit('changeRange', [
                      headStart.offsetStart,
                      headStart.offsetStart,
                      '(' + head,
                    ]),
                  ],
                  {}
                );
              }
            }
          }
        }
      }
    }
  });
}

export function transpose(
  doc: EditableDocument,
  // left = doc.selections.anchor,
  // right = doc.selections.active,
  newPosOffset: { fromLeft?: number; fromRight?: number } = {}
) {
  const edits = [],
    selections = clone(doc.selections);
  doc.selections.forEach((selection, index) => {
    const { start: left, end: right } = selection;

    const cursor = doc.getTokenCursor(right);
    cursor.backwardWhitespace();
    if (cursor.getPrevToken().type == 'open') {
      cursor.forwardSexp();
    }
    cursor.forwardWhitespace();
    if (cursor.getToken().type == 'close') {
      cursor.backwardSexp();
    }
    if (cursor.getToken().type != 'close') {
      const rightStart = cursor.offsetStart;
      if (cursor.forwardSexp()) {
        const rightEnd = cursor.offsetStart;
        cursor.backwardSexp();
        cursor.backwardWhitespace();
        const leftEnd = cursor.offsetStart;
        if (cursor.backwardSexp()) {
          const leftStart = cursor.offsetStart,
            leftText = doc.model.getText(leftStart, leftEnd),
            rightText = doc.model.getText(rightStart, rightEnd);
          let newCursorPos = leftStart + rightText.length;
          if (newPosOffset.fromLeft != undefined) {
            newCursorPos = leftStart + newPosOffset.fromLeft;
          } else if (newPosOffset.fromRight != undefined) {
            newCursorPos = rightEnd - newPosOffset.fromRight;
          }
          edits.push(
            new ModelEdit('changeRange', [rightStart, rightEnd, leftText]),
            new ModelEdit('changeRange', [leftStart, leftEnd, rightText])
          );
          selections[index] = new ModelEditSelection(newCursorPos);
        }
      }
    }
  });
  return doc.model.edit(edits, { selections });
}

export const bindingForms = [
  'let',
  'for',
  'loop',
  'binding',
  'with-local-vars',
  'doseq',
  'with-redefs',
];

function isInPairsList(cursor: LispTokenCursor, pairForms: string[]): boolean {
  const probeCursor = cursor.clone();
  if (probeCursor.backwardList()) {
    const opening = probeCursor.getPrevToken().raw;
    if (opening.endsWith('{') && !opening.endsWith('#{')) {
      return true;
    }
    if (opening.endsWith('[')) {
      probeCursor.backwardUpList();
      const fn = probeCursor.getFunctionName();
      if (fn && pairForms.includes(fn)) {
        return true;
      }
    }
    return false;
  }
  return false;
}

/**
 * Returns the range of the current form
 * or the current form pair, if usePairs is true
 */
function currentSexpsRange(
  doc: EditableDocument,
  cursor: LispTokenCursor,
  offset: number,
  usePairs = false
): [number, number] {
  const currentSingleRange = cursor.rangeForCurrentForm(offset);
  if (usePairs) {
    const ranges = cursor.rangesForSexpsInList();
    if (ranges.length > 1) {
      const indexOfCurrentSingle = ranges.findIndex(
        (r) => r[0] === currentSingleRange[0] && r[1] === currentSingleRange[1]
      );
      if (indexOfCurrentSingle % 2 == 0) {
        const pairCursor = doc.getTokenCursor(currentSingleRange[1]);
        pairCursor.forwardSexp();
        return [currentSingleRange[0], pairCursor.offsetStart];
      } else {
        const pairCursor = doc.getTokenCursor(currentSingleRange[0]);
        pairCursor.backwardSexp();
        return [pairCursor.offsetStart, currentSingleRange[1]];
      }
    }
  }
  return currentSingleRange;
}

export function dragSexprBackward(
  doc: EditableDocument,
  pairForms = bindingForms
  // left = doc.selections.anchor,
  // right = doc.selections.active
) {
  const edits = [],
    selections = clone(doc.selections);

  doc.selections.forEach((selection, index) => {
    const { start: left, end: right } = selection;

    const cursor = doc.getTokenCursor(right);
    const usePairs = isInPairsList(cursor, pairForms);
    const currentRange = currentSexpsRange(doc, cursor, right, usePairs);
    const newPosOffset = right - currentRange[0];
    const backCursor = doc.getTokenCursor(currentRange[0]);
    backCursor.backwardSexp();
    const backRange = currentSexpsRange(doc, backCursor, backCursor.offsetStart, usePairs);
    if (backRange[0] !== currentRange[0]) {
      // there is a sexp to the left
      const leftText = doc.model.getText(backRange[0], backRange[1]);
      const currentText = doc.model.getText(currentRange[0], currentRange[1]);
      edits.push(
        new ModelEdit('changeRange', [currentRange[0], currentRange[1], leftText]),
        new ModelEdit('changeRange', [backRange[0], backRange[1], currentText])
      );
      selections[index] = new ModelEditSelection(backRange[0] + newPosOffset);
    }
  });
  return doc.model.edit(edits, { selections });
}

// TODO: multi
export function dragSexprForward(
  doc: EditableDocument,
  pairForms = bindingForms
  // left = doc.selections.anchor,
  // right = doc.selections.active
) {
  const edits = [],
    selections = clone(doc.selections);

  doc.selections.forEach((selection, index) => {
    const { start: left, end: right } = selection;
    const cursor = doc.getTokenCursor(right);
    const usePairs = isInPairsList(cursor, pairForms);
    const currentRange = currentSexpsRange(doc, cursor, right, usePairs);
    const newPosOffset = currentRange[1] - right;
    const forwardCursor = doc.getTokenCursor(currentRange[1]);
    forwardCursor.forwardSexp();
    const forwardRange = currentSexpsRange(doc, forwardCursor, forwardCursor.offsetStart, usePairs);
    if (forwardRange[0] !== currentRange[0]) {
      // there is a sexp to the right
      const rightText = doc.model.getText(forwardRange[0], forwardRange[1]);
      const currentText = doc.model.getText(currentRange[0], currentRange[1]);
      edits.push(
        new ModelEdit('changeRange', [forwardRange[0], forwardRange[1], currentText]),
        new ModelEdit('changeRange', [currentRange[0], currentRange[1], rightText])
      );

      selections[index] = new ModelEditSelection(
        currentRange[1] + (forwardRange[1] - currentRange[1]) - newPosOffset
      );
    }
  });
  return doc.model.edit(edits, { selections });
}

export type WhitespaceInfo = {
  hasLeftWs: boolean;
  leftWsRange: [number, number];
  leftWs: string;
  leftWsHasNewline: boolean;
  hasRightWs: boolean;
  rightWsRange: [number, number];
  rightWs: string;
  rightWsHasNewline: boolean;
};

/**
 * Collect and return information about the current form regarding its surrounding whitespace
 * @param doc
 * @param p the position in `doc` from where to determine the current form
 */
export function collectWhitespaceInfo(
  doc: EditableDocument,
  p /*  = doc.selections.active */
): WhitespaceInfo {
  const cursor = doc.getTokenCursor(p);
  const currentRange = cursor.rangeForCurrentForm(p);
  const leftWsRight = currentRange[0];
  const leftWsCursor = doc.getTokenCursor(leftWsRight);
  const rightWsLeft = currentRange[1];
  const rightWsCursor = doc.getTokenCursor(rightWsLeft);
  leftWsCursor.backwardWhitespace(false);
  rightWsCursor.forwardWhitespace(false);
  const leftWsLeft = leftWsCursor.offsetStart;
  const leftWs = doc.model.getText(leftWsLeft, leftWsRight);
  const leftWsHasNewline = leftWs.indexOf('\n') !== -1;
  const rightWsRight = rightWsCursor.offsetStart;
  const rightWs = doc.model.getText(rightWsLeft, rightWsRight);
  const rightWsHasNewline = rightWs.indexOf('\n') !== -1;
  return {
    hasLeftWs: leftWs !== '',
    leftWsRange: [leftWsLeft, leftWsRight],
    leftWs,
    leftWsHasNewline,
    hasRightWs: rightWs !== '',
    rightWsRange: [rightWsLeft, rightWsRight],
    rightWs,
    rightWsHasNewline,
  };
}

// TODO: multi
export function dragSexprBackwardUp(
  doc: EditableDocument
  // p = doc.selections.active
) {
  const edits = [],
    selections = clone(doc.selections);

  doc.selections.forEach((selection, index) => {
    const { active: p } = selection;
    const wsInfo = collectWhitespaceInfo(doc, p);
    const cursor = doc.getTokenCursor(p);
    const currentRange = cursor.rangeForCurrentForm(p);
    if (cursor.backwardList() && cursor.backwardUpList()) {
      const listStart = cursor.offsetStart;
      const newPosOffset = p - currentRange[0];
      const newCursorPos = listStart + newPosOffset;
      const listIndent = cursor.getToken().offset;
      let dragText: string, deleteEdit: ModelEdit;
      if (wsInfo.hasLeftWs) {
        dragText =
          doc.model.getText(...currentRange) +
          (wsInfo.leftWsHasNewline ? '\n' + ' '.repeat(listIndent) : ' ');
        const lineCommentCursor = doc.getTokenCursor(wsInfo.leftWsRange[0]);
        const havePrecedingLineComment = lineCommentCursor.getPrevToken().type === 'comment';
        const wsLeftStart = wsInfo.leftWsRange[0] + (havePrecedingLineComment ? 1 : 0);
        deleteEdit = new ModelEdit('deleteRange', [wsLeftStart, currentRange[1] - wsLeftStart]);
      } else {
        dragText =
          doc.model.getText(...currentRange) +
          (wsInfo.rightWsHasNewline ? '\n' + ' '.repeat(listIndent) : ' ');
        deleteEdit = new ModelEdit('deleteRange', [
          currentRange[0],
          wsInfo.rightWsRange[1] - currentRange[0],
        ]);
      }
      edits.push(deleteEdit, new ModelEdit('insertString', [listStart, dragText]));
      selections[index] = new ModelEditSelection(newCursorPos);
    }
  });
  void doc.model.edit(edits, {
    selections,
    skipFormat: false,
    undoStopBefore: true,
  });
}

// TODO: test
// TODO: either forEach and batch edit or forEach sequential
export function dragSexprForwardDown(
  doc: EditableDocument
  // p = doc.selections.active
) {
  const edits = [],
    selections = clone(doc.selections);

  doc.selections.forEach((selection, index) => {
    const { active: p } = selection;

    const wsInfo = collectWhitespaceInfo(doc, p);
    const currentRange = doc.getTokenCursor(p).rangeForCurrentForm(p);
    const newPosOffset = p - currentRange[0];
    const cursor = doc.getTokenCursor(currentRange[0]);
    while (cursor.forwardSexp()) {
      cursor.forwardWhitespace();
      const token = cursor.getToken();
      if (token.type === 'open') {
        const listStart = cursor.offsetStart;
        const deleteLength = wsInfo.rightWsRange[1] - currentRange[0];
        const insertStart = listStart + token.raw.length;
        const newCursorPos = insertStart - deleteLength + newPosOffset;
        const insertText =
          doc.model.getText(...currentRange) + (wsInfo.rightWsHasNewline ? '\n' : ' ');
        edits.push(
          new ModelEdit('insertString', [insertStart, insertText]),
          new ModelEdit('deleteRange', [currentRange[0], deleteLength])
        );
        selections[index] = new ModelEditSelection(newCursorPos);
        break;
      }
    }
  });
  void doc.model.edit(edits, {
    selections,
    skipFormat: false,
    undoStopBefore: true,
  });
}

// TODO: multi
export function dragSexprForwardUp(
  doc: EditableDocument
  // p = doc.selections.active
) {
  const edits = [],
    selections = clone(doc.selections);

  doc.selections.forEach((selection, index) => {
    const { active: p } = selection;

    const wsInfo = collectWhitespaceInfo(doc, p);
    const cursor = doc.getTokenCursor(p);
    const currentRange = cursor.rangeForCurrentForm(p);
    if (cursor.forwardList() && cursor.upList()) {
      const listEnd = cursor.offsetStart;
      const newPosOffset = p - currentRange[0];
      const listWsInfo = collectWhitespaceInfo(doc, listEnd);
      const dragText =
        (listWsInfo.rightWsHasNewline ? '\n' : ' ') + doc.model.getText(...currentRange);
      let deleteStart = wsInfo.leftWsRange[0];
      let deleteLength = currentRange[1] - deleteStart;
      if (wsInfo.hasRightWs) {
        deleteStart = currentRange[0];
        deleteLength = wsInfo.rightWsRange[1] - deleteStart;
      }
      const newCursorPos = listEnd + newPosOffset + 1 - deleteLength;
      edits.push(
        new ModelEdit('insertString', [listEnd, dragText]),
        new ModelEdit('deleteRange', [deleteStart, deleteLength])
      );
      selections[index] = new ModelEditSelection(newCursorPos);
    }
  });
  void doc.model.edit(edits, {
    selections,
    skipFormat: false,
    undoStopBefore: true,
  });
}

// TODO: multi
export function dragSexprBackwardDown(
  doc: EditableDocument
  // p = doc.selections.active
) {
  const edits = [],
    selections = clone(doc.selections);

  doc.selections.forEach((selection, index) => {
    const { active: p } = selection;

    const wsInfo = collectWhitespaceInfo(doc, p);
    const currentRange = doc.getTokenCursor(p).rangeForCurrentForm(p);
    const newPosOffset = p - currentRange[0];
    const cursor = doc.getTokenCursor(currentRange[1]);
    while (cursor.backwardSexp()) {
      cursor.backwardWhitespace();
      const token = cursor.getPrevToken();
      if (token.type === 'close') {
        cursor.previous();
        const listEnd = cursor.offsetStart;
        cursor.backwardWhitespace();
        const siblingWsInfo = collectWhitespaceInfo(doc, cursor.offsetStart);
        const deleteLength = currentRange[1] - wsInfo.leftWsRange[0];
        const insertStart = listEnd;
        const newCursorPos = insertStart + newPosOffset + 1;
        let insertText = doc.model.getText(...currentRange);
        insertText = (siblingWsInfo.leftWsHasNewline ? '\n' : ' ') + insertText;
        edits.push(
          new ModelEdit('deleteRange', [wsInfo.leftWsRange[0], deleteLength]),
          new ModelEdit('insertString', [insertStart, insertText])
        );
        selections[index] = new ModelEditSelection(newCursorPos);
        break;
      }
    }
  });
  void doc.model.edit(edits, {
    selections,
    skipFormat: false,
    undoStopBefore: true,
  });
}

function adaptContentsToRichComment(contents: string): string {
  return contents
    .split(/\n/)
    .map((line) => `  ${line}`)
    .join('\n')
    .trim();
}

// it only warrants multi cursor when invoking the simple "Add Rich Comment" command, if even that
export function addRichComment(
  doc: EditableDocument,
  p = doc.selections[0].active,
  contents?: string
) {
  const richComment = `(comment\n  ${contents ? adaptContentsToRichComment(contents) : ''}\n  )`;
  let cursor = doc.getTokenCursor(p);
  const topLevelRange = rangeForDefun(doc, p, false);
  const isInsideForm = !(p <= topLevelRange[0] || p >= topLevelRange[1]);
  const checkIfAtStartCursor = doc.getTokenCursor(p);
  checkIfAtStartCursor.backwardWhitespace(true);
  const isAtStart = checkIfAtStartCursor.atStart();
  if (isInsideForm || isAtStart) {
    cursor = doc.getTokenCursor(topLevelRange[1]);
  }
  const inLineComment =
    cursor.getPrevToken().type === 'comment' || cursor.getToken().type === 'comment';
  if (inLineComment) {
    cursor.forwardWhitespace(true);
    cursor.backwardWhitespace(false);
  }
  const insertStart = cursor.offsetStart;
  const insideNextTopLevelFormPos = rangeToForwardDownList(doc, insertStart)[1];
  if (!contents && insideNextTopLevelFormPos !== insertStart) {
    const checkIfRichCommentExistsCursor = doc.getTokenCursor(insideNextTopLevelFormPos);
    checkIfRichCommentExistsCursor.forwardWhitespace(true);
    if (checkIfRichCommentExistsCursor.getToken().raw == 'comment') {
      checkIfRichCommentExistsCursor.forwardSexp();
      checkIfRichCommentExistsCursor.forwardWhitespace(false);
      // insert nothing, just place cursor
      const newCursorPos = checkIfRichCommentExistsCursor.offsetStart;
      void doc.model.edit([new ModelEdit('insertString', [newCursorPos, ''])], {
        selections: [new ModelEditSelection(newCursorPos)],
        skipFormat: true,
        undoStopBefore: false,
      });
      return;
    }
  }
  cursor.backwardWhitespace(false);
  const leftWs = doc.model.getText(cursor.offsetStart, insertStart);
  cursor.forwardWhitespace(false);
  const rightWs = doc.model.getText(insertStart, cursor.offsetStart);
  const numPrependNls = leftWs.match('\n\n') ? 0 : leftWs.match('\n') ? 1 : 2;
  const numAppendNls = rightWs.match('\n\n') ? 0 : rightWs.match('^\n') ? 1 : 2;
  const prepend = '\n'.repeat(numPrependNls);
  const append = '\n'.repeat(numAppendNls);
  const insertText = `${prepend}${richComment}${append}`;
  const newCursorPos = insertStart + 11 + numPrependNls * doc.model.lineEndingLength;
  void doc.model.edit([new ModelEdit('insertString', [insertStart, insertText])], {
    selections: [new ModelEditSelection(newCursorPos)],
    skipFormat: false,
    undoStopBefore: true,
  });
}
