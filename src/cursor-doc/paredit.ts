import { FormatterConfig } from '../formatter-config';
import { validPair } from './clojure-lexer';
import {
  ModelEdit,
  EditableDocument,
  ModelEditSelection,
  ModelEditRange,
  ModelEditDirectedRange,
  ModelEditOptions,
} from './model';
import { LispTokenCursor } from './token-cursor';
import { backspaceOnWhitespace } from './backspace-on-whitespace';
import _ = require('lodash');
import { isEqual, last, property } from 'lodash';
import { TextEditorEdit } from 'vscode';

// NB: doc.model.edit returns a Thenable, so that the vscode Editor can compose commands.
// But don't put such chains in this module because that won't work in the repl-console.
// In the repl-console, compose commands just by performing them in succession, making sure
// you provide selections, old and new.

// TODO: Implement all movement and selection commands here, instead of composing them
//       exactly the same way in the editor and in the repl-window.
//       Example: paredit.moveToRangeRight(this.readline, paredit.forwardSexpRange(this.readline))
//                => paredit.moveForwardSexp(this.readline)

export async function killRange(
  doc: EditableDocument,
  range: [number, number],
  start = doc.selections[0].anchor,
  end = doc.selections[0].active,
  editOptions: Omit<ModelEditOptions, 'selections'> = { skipFormat: false }
) {
  const [left, right] = [Math.min(...range), Math.max(...range)];
  return doc.model.edit([new ModelEdit('deleteRange', [left, right - left, [start, end]])], {
    ...editOptions,
    selections: [new ModelEditSelection(left)],
  });
}

export function moveToRangeLeft(doc: EditableDocument, ranges: ModelEditRange[]) {
  doc.selections = ranges.map((range) => new ModelEditSelection(Math.min(range[0], range[1])));
}

export function moveToRangeRight(doc: EditableDocument, ranges: ModelEditRange[]) {
  doc.selections = ranges.map((range) => new ModelEditSelection(Math.max(range[0], range[1])));
}

export function selectRange(doc: EditableDocument, ranges: ModelEditRange[]) {
  growSelectionStack(doc, ranges);
}

export function selectCurrentForm(
  doc: EditableDocument,
  topLevel: boolean,
  selections = doc.selections
) {
  const newSels = selections.map((sel) => {
    const selection = sel;
    if (selection.isCursor) {
      let codeSelection;
      const cursor = doc.getTokenCursor(selection.active);
      const range = topLevel
        ? cursor.rangeForDefun(selection.active)
        : cursor.rangeForCurrentForm(selection.active);
      if (range) {
        codeSelection = new ModelEditSelection(range[0], range[1]);
      } else {
        codeSelection = undefined;
      }
      if (codeSelection) {
        return codeSelection;
      }
    }
    return sel;
  });

  growSelectionStack(doc, newSels.map(_.property('asDirectedRange')));
}

export function selectRangeForward(
  doc: EditableDocument,
  ranges: ModelEditRange[],
  selections = doc.selections
) {
  growSelectionStack(
    doc,
    ranges.map((range, index) => {
      return [selections[index].anchor, Math.max(range[0], range[1])];
    })
  );
}

export function selectRangeBackward(
  doc: EditableDocument,
  ranges: ModelEditRange[],
  selections = doc.selections
) {
  growSelectionStack(
    doc,
    ranges.map((range, index) => [selections[index].anchor, Math.min(range[0], range[1])])
  );
}

export function selectForwardSexp(doc: EditableDocument, selections = doc.selections) {
  const ranges = selections.map((selection) =>
    selection.active >= selection.anchor
      ? forwardSexpRange(doc, selection.end)
      : forwardSexpRange(doc, selection.active, true)
  );
  selectRangeForward(doc, ranges, selections);
}

export function selectRight(doc: EditableDocument, selections = doc.selections) {
  const ranges = selections.map((selection) =>
    selection.active >= selection.anchor
      ? forwardHybridSexpRange(doc, selection.end)
      : forwardHybridSexpRange(doc, selection.active, true)
  );
  selectRangeForward(doc, ranges);
}

export function selectForwardSexpOrUp(doc: EditableDocument, selections = doc.selections) {
  const ranges = selections.map((selection) =>
    selection.active >= selection.anchor
      ? forwardSexpOrUpRange(doc, selection.end)
      : forwardSexpOrUpRange(doc, selection.active, true)
  );
  selectRangeForward(doc, ranges);
}

export function selectBackwardSexp(doc: EditableDocument, selections = doc.selections) {
  const ranges = selections.map((selection) =>
    selection.active <= selection.anchor
      ? backwardSexpRange(doc, selection.start)
      : backwardSexpRange(doc, selection.active, false)
  );
  selectRangeBackward(doc, ranges);
}

export function selectForwardDownSexp(doc: EditableDocument, selections = doc.selections) {
  const ranges = selections.map((selection) =>
    selection.active >= selection.anchor
      ? rangeToForwardDownList(doc, selection.active, true)
      : rangeToForwardDownList(doc, selection.active, true)
  );
  selectRangeForward(doc, ranges);
}

export function selectBackwardDownSexp(doc: EditableDocument, selections = doc.selections) {
  selectRangeBackward(
    doc,
    selections.map((selection) => rangeToBackwardDownList(doc, selection.start))
  );
}

export function selectForwardUpSexp(doc: EditableDocument, selections = doc.selections) {
  selectRangeForward(
    doc,
    selections.map((selection) => rangeToForwardUpList(doc, selection.active))
  );
}

export function selectBackwardUpSexp(doc: EditableDocument, selections = doc.selections) {
  const ranges = selections.map((selection) =>
    selection.active <= selection.anchor
      ? rangeToBackwardUpList(doc, selection.active, false)
      : rangeToBackwardUpList(doc, selection.active, false)
  );
  selectRangeBackward(doc, ranges);
}

export function selectBackwardSexpOrUp(doc: EditableDocument, selections = doc.selections) {
  const ranges = selections.map((selection) =>
    selection.active <= selection.anchor
      ? backwardSexpOrUpRange(doc, selection.active, false)
      : backwardSexpOrUpRange(doc, selection.active, false)
  );
  selectRangeBackward(doc, ranges);
}

export function selectCloseList(doc: EditableDocument, selections = doc.selections) {
  selectRangeForward(
    doc,
    selections.map((selection) => rangeToForwardList(doc, selection.active))
  );
}

export function selectOpenList(doc: EditableDocument, selections = doc.selections) {
  selectRangeBackward(
    doc,
    selections.map((selection) => rangeToBackwardList(doc, selection.start))
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
  offset = Math.max(doc.selections[0].anchor, doc.selections[0].active),
  goUpSexp: GoUpSexpOption,
  goPastWhitespace = false
): ModelEditRange {
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
}

/**
 * Return a modified selection range on doc. Moves the left limit around sexps, potentially moving up.
 */
function _backwardSexpRange(
  doc: EditableDocument,
  offset: number = doc.selections[0].start,
  goUpSexp: GoUpSexpOption,
  goPastWhitespace = false
): ModelEditRange {
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
}

export function forwardSexpRange(
  doc: EditableDocument,
  offset = doc.selections[0].end,
  goPastWhitespace = false
): ModelEditRange {
  return _forwardSexpRange(doc, offset, GoUpSexpOption.Never, goPastWhitespace);
}

export function backwardSexpRange(
  doc: EditableDocument,
  offset = doc.selections[0].start,
  goPastWhitespace = false
): ModelEditRange {
  return _backwardSexpRange(doc, offset, GoUpSexpOption.Never, goPastWhitespace);
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
 * If squashWhitespace is true, then successive whitespace characters after the cursor are squashed.
 * This function's output range is needed to implement features similar to paredit's
 * killRight or smartparens' sp-kill-hybrid-sexp.
 *
 * @param doc
 * @param offset
 * @param squashWhitespace
 * @returns [number, number]
 */
export function forwardHybridSexpRange(
  doc: EditableDocument,
  offset = doc.selections[0].end,
  squashWhitespace = true
): ModelEditDirectedRange {
  let cursor = doc.getTokenCursor(offset);
  // If at list open, return the range of the list
  if (cursor.getToken().type === 'open') {
    return forwardSexpRange(doc);
    // else if at list close (but still in it), don't move
  } else if (cursor.getToken().type === 'close') {
    return [offset, offset];
  }

  const currentLineText = doc.model.getLineText(cursor.line);
  const lineStart = doc.model.getOffsetForLine(cursor.line);
  const currentLineNewlineOffset = lineStart + currentLineText.length;
  // contents of line from cursor to end of line, including newline chars
  const remainderLineText = doc.model.getText(
    offset,
    currentLineNewlineOffset + doc.model.lineEndingLength
  );

  cursor.forwardList(); // move to the end of the current form if possible
  const currentFormEndToken = cursor.getToken();
  // If we've advanced the cursor but the current token's start is behind us,
  // then jump to the end.
  // Happens when offset is in a clojure comment or whitespace, i.e: ';; -|---' or ' | '
  const cursorOffsetEnd = cursor.offsetStart <= offset ? cursor.offsetEnd : cursor.offsetStart;
  const text = doc.model.getText(offset, cursorOffsetEnd);
  let hasNewline = text.indexOf(doc.model.lineEnding) !== -1;
  let end = cursorOffsetEnd;

  // Want the min of closing token or newline
  // After moving forward, the cursor is not yet at the end of the current line,
  // and it is not a close token. So we include the newline
  // because what forms are here extend beyond the end of the current line
  if (currentLineNewlineOffset > cursor.offsetEnd && currentFormEndToken.type != 'close') {
    hasNewline = true;
    end = currentLineNewlineOffset;
  }

  // need to squash whitespace?
  if (remainderLineText === '' || remainderLineText === doc.model.lineEnding) {
    const squashCursor = doc.getTokenCursor(currentLineNewlineOffset);
    if (squashWhitespace && squashCursor.next().getToken().raw.endsWith(' ')) {
      // jump ahead to penultimate whitepspace character
      end =
        currentLineNewlineOffset +
        doc.model.lineEndingLength +
        squashCursor.getToken().raw.length -
        1;
    } else {
      end = currentLineNewlineOffset + doc.model.lineEndingLength;
    }
  } else if (hasNewline) {
    // Try to find the first open token to the right of offset, if any
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
}

/**
 * Aims to find the start of the current form (list|vector|map|set|string etc).
 * Similar to `forwardHybridSexpRange` but moves backwards.
 * When there is whitespace (ws) before the start of the current form's non-ws text:
 *  - Return the start of the nearest form to the left of the cursor location if one exists
 *  - Return the start of the non-whitespace contents's offset if no form exists
 * When invoked at the first non-ws contents of the line (eg at an indent):
 *  - Return the line start, which is previous line's newline char + 1
 *
 * If squashWhitespace is true, then successive whitespace characters after the cursor are squashed.
 *
 * Diverges from most other paredit fns here in that it returns both a range and ModelEditOptions,
 * so as to express whether it's only killing preceding non-newline-whitespace.
 * This is in order for `killRange` caller to know whether to conditionally
 * disable post-edit auto formatting/indenting.
 *
 * @param doc
 * @param offset
 * @param squashWhitespace
 * @returns {range: [number, number], editOptions: ModelEditOptions}
 */
export function backwardHybridSexpRange(
  doc: EditableDocument,
  offset = doc.selections[0].start,
  squashWhitespace = true
): { range: ModelEditDirectedRange; editOptions: ModelEditOptions } {
  let cursor = doc.getTokenCursor(offset - 1);

  // weird edge case in windows where if the cursor is between \r\n and list close
  // like `\r\n|)`, it needs to move back 2 characters to know the tokenCursor is an eol
  // otherwise, doc.getTokenCursor(offset) & doc.getTokenCursor(offset - 1) are the same:
  // the list close token
  if ('\r\n)' === doc.model.getText(offset - 2, offset + 1)) {
    cursor = doc.getTokenCursor(offset - 2);
  }

  if (cursor.getToken().type === 'close') {
    return { range: backwardSexpRange(doc), editOptions: { skipFormat: false } };
  } else if (cursor.getToken().type === 'open') {
    return { range: [offset, offset], editOptions: { skipFormat: false } };
  } else if (cursor.getToken().raw === '\n') {
    cursor = doc.getTokenCursor(offset);
  }

  let currentLineStartOffset = doc.model.getOffsetForLine(cursor.line);
  let remainderLineText = doc.model.getText(
    currentLineStartOffset - doc.model.lineEndingLength,
    offset
  );

  // there is post-edit formatting we want to suppress if we're only cutting line start whitespace,
  // otherwise, the formatter will auto indent back to whatever the user tried to kill
  const isOnlyKillingWhitespace =
    remainderLineText.substring(doc.model.lineEndingLength).trim().length === 0;

  // if we're NOT only killing whitespace, ensure we only cut to the beginning of non-whitespace.
  // if user wants to cut non-ws *and* ws at beginning of line, let em killLeft twice.
  // we do this by making reminderLineText & currentLineStartOffset start at the non-ws
  if (!isOnlyKillingWhitespace) {
    currentLineStartOffset +=
      remainderLineText.indexOf(remainderLineText.trimStart()) - doc.model.lineEndingLength;
    remainderLineText = doc.model.getText(
      currentLineStartOffset - doc.model.lineEndingLength,
      offset
    );
  }

  // the main "meat" of killLeft, killing left until ws or list opening
  cursor.backwardList(); // move to the start of the current form
  // -1 to include opening token
  const currentFormStartToken = doc.getTokenCursor(cursor.offsetStart - 1).getToken();

  const cursorOffsetStart = cursor.offsetStart;
  const text = doc.model.getText(cursorOffsetStart, offset);
  let hasNewline = text.indexOf('\n') !== -1;
  let start = cursorOffsetStart;

  // Want the max of opening token or newline (/line start)
  // After moving backward, the cursor may not yet be at the start of the current line,
  // and it is not a open token. So we include the newline
  // because what forms are here extend backwards beyond the start of the current line
  if (currentLineStartOffset <= cursor.offsetStart && currentFormStartToken.type != 'open') {
    hasNewline = true;
    start = currentLineStartOffset;
  }
  // need to squash whitespace?
  if (remainderLineText === '' || remainderLineText === doc.model.lineEnding) {
    const squashCursor = doc.getTokenCursor(currentLineStartOffset - doc.model.lineEndingLength);
    const prevCursor = squashCursor.previous();
    if (squashWhitespace && prevCursor?.getToken().raw.endsWith(' ')) {
      start =
        currentLineStartOffset -
        doc.model.lineEndingLength -
        squashCursor.getToken().raw.length +
        1;
    } else {
      start = currentLineStartOffset - doc.model.lineEndingLength;
    }
  } else if (hasNewline) {
    // Try to find the first close token to the left of the document's cursor location if any
    let nearestCloseTokenOffset = -1;

    // Start at the line start.
    // Work forwards to find the largest close token offset
    // less than the document's cursor location if any
    cursor = doc.getTokenCursor(currentLineStartOffset);
    while (cursor.offsetEnd < offset) {
      while (cursor.forwardSexp()) {
        // move forward until the cursor cannot move forward anymore
      }
      if (cursor.offsetEnd < offset) {
        nearestCloseTokenOffset = cursor.offsetStart;
        cursor = doc.getTokenCursor(cursor.offsetEnd);
      }
    }

    if (nearestCloseTokenOffset > 0) {
      cursor = doc.getTokenCursor(nearestCloseTokenOffset);
      cursor.backwardList();
      start = cursor.offsetStart - 1; // include the closing token
    } else {
      // no open tokens found so the end is the newline
      start = currentLineStartOffset;
    }
  }
  return { range: [start, offset], editOptions: { skipFormat: isOnlyKillingWhitespace } };
}

export function rangeToForwardUpList(
  doc: EditableDocument,
  offset = doc.selections[0].end,
  goPastWhitespace = false
): ModelEditRange {
  return _forwardSexpRange(doc, offset, GoUpSexpOption.Required, goPastWhitespace);
}

export function rangeToBackwardUpList(
  doc: EditableDocument,
  offset = doc.selections[0].start,
  goPastWhitespace = false
): ModelEditRange {
  return _backwardSexpRange(doc, offset, GoUpSexpOption.Required, goPastWhitespace);
}

export function forwardSexpOrUpRange(
  doc: EditableDocument,
  offset = doc.selections[0].end,
  goPastWhitespace = false
): ModelEditRange {
  return _forwardSexpRange(doc, offset, GoUpSexpOption.WhenAtLimit, goPastWhitespace);
}

export function backwardSexpOrUpRange(
  doc: EditableDocument,
  offset = doc.selections[0].start,
  goPastWhitespace = false
): ModelEditRange {
  return _backwardSexpRange(doc, offset, GoUpSexpOption.WhenAtLimit, goPastWhitespace);
}

export function rangeToForwardDownList(
  doc: EditableDocument,
  offset = doc.selections[0].end,
  goPastWhitespace = false
): ModelEditRange {
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
  offset = doc.selections[0].start,
  goPastWhitespace = false
): ModelEditRange {
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
  offset = doc.selections[0].end
): ModelEditRange {
  const cursor = doc.getTokenCursor(offset);
  if (cursor.forwardList()) {
    return [offset, cursor.offsetStart];
  } else {
    return [offset, offset];
  }
}

export function rangeToBackwardList(
  doc: EditableDocument,
  offset = doc.selections[0].start
): ModelEditRange {
  const cursor = doc.getTokenCursor(offset);
  if (cursor.backwardList()) {
    return [cursor.offsetStart, offset];
  } else {
    return [offset, offset];
  }
}

export async function wrapSexpr(
  doc: EditableDocument,
  open: string,
  close: string,
  start: number = doc.selections[0].anchor,
  end: number = doc.selections[0].active,
  options = { skipFormat: false }
) {
  const cursor = doc.getTokenCursor(end);
  if (cursor.withinString() && open == '"') {
    open = close = '\\"';
  }
  if (start == end) {
    // No selection
    const currentFormRange = cursor.rangeForCurrentForm(start);
    if (currentFormRange) {
      const range = currentFormRange;
      return doc.model.edit(
        [
          new ModelEdit('insertString', [range[1], close]),
          new ModelEdit('insertString', [
            range[0],
            open,
            [end, end],
            [start + open.length, start + open.length],
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
    return doc.model.edit(
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
}

/**
 * 'Rewraps' the lists containing each cursor/selection, as provided by `selections`, with
 * the provided `open` and `close` strings.
 *
 * Single cursor is just the simpler special case when `selections.length` is 1
 * High level overview:
 * - For each cursor, find the offsets/ranges for its containing list's open/close tokens.
 * - Make 2 ModelEdits for each token's replacement +  1 Selection; record the offset change.
 * - Dedupe each edit (as multi cursors could be in the same list).
 * - Finally, apply the edits.
 *
 * @param doc
 * @param open
 * @param close
 * @param selections
 * @returns
 */
export function rewrapSexpr(
  doc: EditableDocument,
  open: string,
  close: string,
  selections = [doc.selections[0]]
) {
  const edits: ModelEdit<'changeRange'>[] = [];

  selections.forEach((sel, index) => {
    const { active } = sel;
    const cursor = doc.getTokenCursor(active);
    if (cursor.backwardList()) {
      cursor.backwardUpList();
      const openStart = cursor.offsetStart;
      const oldOpenLength = cursor.getToken().raw.length;
      const oldOpenEnd = openStart + oldOpenLength;
      if (cursor.forwardSexp()) {
        const closeStart = cursor.offsetStart - close.length;
        const closeEnd = cursor.offsetStart;
        edits.push(
          new ModelEdit('changeRange', [closeStart, closeEnd, close]),
          new ModelEdit('changeRange', [openStart, oldOpenEnd, open])
        );
      }
    }
  });

  // Due to the nature of dealing with list boundaries, multiple cursors could be targeting
  // the same lists, which will result in attempting to delete the same ranges twice. So we dedupe.
  const uniqEdits = _.uniqWith(edits, _.isEqual);

  // edit needs the ModelEdit array in order from end-of-doc to start
  const editsToApply = _(uniqEdits)
    .sortBy((e) => -e.args[0])
    .value();
  return doc.model.edit(editsToApply, {
    //skipFormat: selections.length > 1, // reformat-as-you-type works with only 1 selection
  });
}

export async function splitSexp(doc: EditableDocument, start: number = doc.selections[0].active) {
  const cursor = doc.getTokenCursor(start);
  if (!cursor.withinString() && !(cursor.isWhiteSpace() || cursor.previousIsWhiteSpace())) {
    cursor.forwardWhitespace();
  }
  const splitPos = cursor.withinString() ? start : cursor.offsetStart;
  if (cursor.backwardList()) {
    const open = cursor.getPrevToken().raw;
    if (cursor.forwardList()) {
      const close = cursor.getToken().raw;
      return doc.model.edit(
        [new ModelEdit('changeRange', [splitPos, splitPos, `${close}${open}`])],
        {
          selections: [new ModelEditSelection(splitPos + 1)],
        }
      );
    }
  }
}

/**
 * If `start` is between two strings or two lists of the same type: join them. Otherwise do nothing.
 * @param doc
 * @param start
 */
export async function joinSexp(
  doc: EditableDocument,
  start: number = doc.selections[0].active
): Promise<Thenable<boolean>> {
  const cursor = doc.getTokenCursor(start);
  cursor.backwardWhitespace();
  const prevToken = cursor.getPrevToken(),
    prevEnd = cursor.offsetStart;
  if (['close', 'str-end', 'str'].includes(prevToken.type)) {
    cursor.forwardWhitespace();
    const nextToken = cursor.getToken(),
      nextStart = cursor.offsetStart;
    if (validPair(nextToken.raw[0], prevToken.raw[prevToken.raw.length - 1])) {
      return doc.model.edit(
        [
          new ModelEdit('changeRange', [
            prevEnd - 1,
            nextStart + 1,
            prevToken.type === 'close' ? ' ' : '',
            [start, start],
            [prevEnd, prevEnd],
          ]),
        ],
        { selections: [new ModelEditSelection(prevEnd)], formatDepth: 2 }
      );
    }
  }
}

export async function spliceSexp(
  doc: EditableDocument,
  start: number = doc.selections[0].active,
  undoStopBefore = true
): Promise<Thenable<boolean>> {
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
      return doc.model.edit(
        [
          new ModelEdit('changeRange', [end, end + close.raw.length, '']),
          new ModelEdit('changeRange', [beginning - open.raw.length, beginning, '']),
        ],
        { undoStopBefore, selections: [new ModelEditSelection(start - 1)] }
      );
    }
  }
}

export async function killBackwardList(doc: EditableDocument, [start, end]: [number, number]) {
  return doc.model.edit(
    [new ModelEdit('changeRange', [start, end, '', [end, end], [start, start]])],
    {
      selections: [new ModelEditSelection(start)],
    }
  );
}

export async function killForwardList(doc: EditableDocument, [start, end]: [number, number]) {
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

export async function forwardSlurpSexp(
  doc: EditableDocument,
  start: number = doc.selections[0].active,
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
    if (cursor.forwardSexp(true, true)) {
      wsOutSideCursor.forwardWhitespace(false);
      const wsEndOffset = wsOutSideCursor.offsetStart;
      const newCloseOffset = cursor.offsetStart;
      const replacedText = doc.model.getText(wsStartOffset, wsEndOffset);
      const changeArgs =
        replacedText.indexOf('\n') >= 0
          ? ([currentCloseOffset, currentCloseOffset + close.length, ''] as const)
          : ([wsStartOffset, wsEndOffset, ' '] as const);
      return doc.model.edit(
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
      const formatDepth = extraOpts['formatDepth'] ? extraOpts['formatDepth'] : 1;
      return forwardSlurpSexp(doc, cursor.offsetStart, {
        formatDepth: formatDepth + 1,
      });
    }
  }
}

export async function backwardSlurpSexp(
  doc: EditableDocument,
  start: number = doc.selections[0].active,
  extraOpts = {}
) {
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
      return doc.model.edit(
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
      return backwardSlurpSexp(doc, cursor.offsetStart, {
        formatDepth: formatDepth + 1,
      });
    }
  }
}

export async function forwardBarfSexp(
  doc: EditableDocument,
  start: number = doc.selections[0].active
) {
  const cursor = doc.getTokenCursor(start);
  cursor.forwardList();
  if (cursor.getToken().type == 'close') {
    const offset = cursor.offsetStart,
      close = cursor.getToken().raw;
    cursor.backwardSexp(true, true);
    cursor.backwardWhitespace();
    return doc.model.edit(
      [
        new ModelEdit('deleteRange', [offset, close.length]),
        new ModelEdit('insertString', [cursor.offsetStart, close]),
      ],
      start >= cursor.offsetStart
        ? {
            selections: [new ModelEditSelection(cursor.offsetStart)],
            formatDepth: 2,
          }
        : { formatDepth: 2 }
    );
  }
}

export async function backwardBarfSexp(
  doc: EditableDocument,
  start: number = doc.selections[0].active
) {
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
    return doc.model.edit(
      [
        new ModelEdit('changeRange', [cursor.offsetStart, cursor.offsetStart, close]),
        new ModelEdit('deleteRange', [offset, tk.raw.length]),
      ],
      start <= cursor.offsetStart
        ? {
            selections: [new ModelEditSelection(cursor.offsetStart)],
            formatDepth: 2,
          }
        : { formatDepth: 2 }
    );
  }
}

export function open(
  doc: EditableDocument,
  open: string,
  close: string,
  start: number = doc.selections[0].active
) {
  const [cs, ce] = [doc.selections[0].anchor, doc.selections[0].active];
  doc.insertString(open + doc.getSelectionText() + close);
  if (cs != ce) {
    doc.selections = [new ModelEditSelection(cs + open.length, ce + open.length)];
  } else {
    doc.selections = [new ModelEditSelection(start + open.length)];
  }
}

export async function close(
  doc: EditableDocument,
  close: string,
  start: number = doc.selections[0].active
) {
  const cursor = doc.getTokenCursor(start);
  const inString = cursor.withinString();
  cursor.forwardWhitespace(false);
  if (cursor.getToken().raw === close) {
    doc.selections = [new ModelEditSelection(cursor.offsetEnd)];
  } else {
    if (!inString && cursor.docIsBalanced()) {
      // Do nothing when there is balance
    } else {
      return doc.model.edit([new ModelEdit('insertString', [start, close])], {
        selections: [new ModelEditSelection(start + close.length)],
      });
    }
  }
}

function onlyWhitespaceLeftOfCursor(offset, cursor: LispTokenCursor) {
  return cursor.isOnlyWhitespaceLeftOfCursor(offset);
}

function backspaceOnWhitespaceEdit(
  builder: TextEditorEdit,
  doc: EditableDocument,
  cursor: LispTokenCursor,
  config?: FormatterConfig
) {
  const changeArgs = backspaceOnWhitespace(doc, cursor, config);
  return doc.model.editNow(
    [
      new ModelEdit('deleteRange', [changeArgs.end, changeArgs.start - changeArgs.end]),
      new ModelEdit('insertString', [changeArgs.end, ' '.repeat(changeArgs.indent)]),
    ],
    {
      builder: builder,
      skipFormat: true,
    }
  );
}

export function backspace(
  doc: EditableDocument,
  builder?: TextEditorEdit,
  config?: FormatterConfig,
  start: number = doc.selections[0].anchor,
  end: number = doc.selections[0].active
): void {
  if (start != end) {
    const [left, right] = [Math.min(start, end), Math.max(start, end)];
    return doc.model.editNow([new ModelEdit('deleteRange', [left, right - left])], {
      builder: builder,
      skipFormat: true,
    });
  } else {
    const cursor = doc.getTokenCursor(start);
    const isTopLevel = doc.getTokenCursor(end).atTopLevel();
    const nextToken = cursor.getToken();
    const prevToken =
      start > cursor.offsetStart && !['open', 'close'].includes(nextToken.type)
        ? nextToken // we are “in” a token
        : cursor.getPrevToken(); // we are “between” tokens
    if (prevToken.type == 'prompt') {
      return;
    } else if (nextToken.type == 'prompt') {
      return;
    } else if (doc.model.getText(start - 2, start, true) == '\\"') {
      // delete quoted double quote
      return doc.model.editNow([new ModelEdit('deleteRange', [start - 2, 2])], {
        builder: builder,
        skipFormat: true,
      });
    } else if (prevToken.type === 'open' && nextToken.type === 'close') {
      // delete empty list
      return doc.model.editNow(
        [new ModelEdit('deleteRange', [start - prevToken.raw.length, prevToken.raw.length + 1])],
        {
          builder: builder,
        }
      );
    } else if (
      !isTopLevel &&
      !cursor.withinString() &&
      onlyWhitespaceLeftOfCursor(doc.selections[0].anchor, cursor)
    ) {
      // we are at the beginning of a line, and not inside a string
      return backspaceOnWhitespaceEdit(builder, doc, cursor, config);
    } else {
      if (['open', 'close'].includes(prevToken.type) && cursor.docIsBalanced()) {
        doc.selections = [new ModelEditSelection(start - prevToken.raw.length)];
        return;
      } else {
        const [left, right] = [Math.max(start - 1, 0), start];
        return doc.model.editNow([new ModelEdit('deleteRange', [left, right - left])], {
          builder: builder,
          skipFormat: true,
        });
      }
    }
  }
}

export function deleteForward(
  doc: EditableDocument,
  builder?: TextEditorEdit,
  start: number = doc.selections[0].anchor,
  end: number = doc.selections[0].active
) {
  if (start != end) {
    const [left, right] = [Math.min(start, end), Math.max(start, end)];
    return doc.model.editNow([new ModelEdit('deleteRange', [start, end - start])], {
      builder: builder,
    });
  } else {
    // Note: skipFormat, lest formatter unexpectedly move the point (eg skipping past commas)
    const cursor = doc.getTokenCursor(start);
    const prevToken = cursor.getPrevToken();
    const nextToken = cursor.getToken();
    const p = start;
    if (doc.model.getText(p, p + 2, true) == '\\"') {
      return doc.model.editNow([new ModelEdit('deleteRange', [p, 2])], {
        builder: builder,
        skipFormat: true,
      });
    } else if (prevToken.type === 'open' && nextToken.type === 'close') {
      return doc.model.editNow(
        [new ModelEdit('deleteRange', [p - prevToken.raw.length, prevToken.raw.length + 1])],
        {
          builder: builder,
        }
      );
    } else {
      if (['open', 'close'].includes(nextToken.type) && cursor.docIsBalanced()) {
        doc.selections = [new ModelEditSelection(p + 1)];
        return;
      } else {
        return doc.model.editNow([new ModelEdit('deleteRange', [start, 1])], {
          builder: builder,
          skipFormat: true,
        });
      }
    }
  }
}

export async function stringQuote(
  doc: EditableDocument,
  start: number = doc.selections[0].anchor,
  end: number = doc.selections[0].active
) {
  if (start != end) {
    doc.insertString('"');
  } else {
    const cursor = doc.getTokenCursor(start);
    if (cursor.withinString()) {
      // inside a string, let's be clever
      if (cursor.getToken().type == 'close') {
        if (doc.model.getText(0, start).endsWith('\\')) {
          return doc.model.edit([new ModelEdit('changeRange', [start, start, '"'])], {
            selections: [new ModelEditSelection(start + 1)],
          });
        } else {
          return close(doc, '"', start);
        }
      } else {
        if (doc.model.getText(0, start).endsWith('\\')) {
          return doc.model.edit([new ModelEdit('changeRange', [start, start, '"'])], {
            selections: [new ModelEditSelection(start + 1)],
          });
        } else {
          return doc.model.edit([new ModelEdit('changeRange', [start, start, '\\"'])], {
            selections: [new ModelEditSelection(start + 2)],
          });
        }
      }
    } else {
      return doc.model.edit([new ModelEdit('changeRange', [start, start, '""'])], {
        selections: [new ModelEditSelection(start + 1)],
      });
    }
  }
}

/**
 * Given the set of selections in the given document,
 * expand each selection to the next structural boundary,
 * ie, the containing sexp.
 *
 * (Or in other words, the S-expression powered equivalent to vs-code's
 * built-in Expand Selection/Shrink Selection commands)
 * // TODO: Inside string should first select contents
 */
export function growSelection(doc: EditableDocument, selections = doc.selections) {
  const newRanges = selections.map<[number, number]>(({ anchor: start, active: end }) => {
    const startC = doc.getTokenCursor(start),
      endC = doc.getTokenCursor(end),
      emptySelection = startC.equals(endC);

    // check if selection is empty - means just a cursor
    if (emptySelection) {
      const currentFormRange = startC.rangeForCurrentForm(start);
      // check if there's a form containing the current cursor
      if (currentFormRange) {
        return currentFormRange;
      }
      // if there's not, do nothing, we will not be expanding this cursor
      return [start, end];
    } else {
      // check if there's a list containing the current form
      if (startC.getPrevToken().type == 'open' && endC.getToken().type == 'close') {
        startC.backwardList();
        startC.backwardUpList();
        endC.forwardList();
        return [startC.offsetStart, endC.offsetEnd];
        // check if we need to handle binding pairs
      } else if (isInPairsList(startC, bindingForms)) {
        const pairRange = currentSexpsRange(doc, startC, start, true);
        // if pair not already selected, expand to pair
        if (!_.isEqual(pairRange, [start, end])) {
          return pairRange;
        }
        // else, if pair already selected, next section should handle whole list
      }

      // expand to whole list contents, if appropriate
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
      return [startC.offsetStart, endC.offsetEnd];
    }
  });
  growSelectionStack(doc, newRanges);
}

export function growSelectionStack(doc: EditableDocument, ranges: Array<[number, number]>) {
  // Check if there's a history already
  if (doc.selectionsStack.length > 0) {
    const prev = last(doc.selectionsStack);
    // Check if user has diverged from history
    // (eg, they grew/shrank and then made an arbitrary selection)
    if (
      !(
        isEqual(doc.selections.map(property('anchor')), prev.map(property('anchor'))) &&
        isEqual(doc.selections.map(property('active')), prev.map(property('active')))
      )
    ) {
      // Therefore, let's reset the selection set history
      setSelectionStack(doc);

      // Wlse, check if the intended new selection set is already the latest step
      // in the history - meaning the user grew, shrank then grew again.
    } else if (
      isEqual(prev.map(property('anchor')), ranges.map(property(0))) &&
      isEqual(prev.map(property('active')), ranges.map(property(1)))
    ) {
      return;
    }
  } else {
    // start a "fresh" selection set expansion history
    setSelectionStack(doc, [doc.selections]);
  }
  doc.selections = ranges.map((range) => new ModelEditSelection(...range));
  doc.selectionsStack.push(doc.selections);
}

// TODO(multi-cursor): Simplify algo once multicursor is fully complete
// It currently loses data, so to speak, if the number of cursors changes between calls to growSelection as we limit the number of selections to the length of the `selections` argument.
// Once multicursor is no longer experimental, simply set doc.selections to the 2nd-last selectionsStack step
// The commented code lines can simply be uncommented once multicursor is ready.
export function shrinkSelection(doc: EditableDocument, selections = doc.selections) {
  // if there's a history currently,
  if (doc.selectionsStack.length) {
    const latestSelections = doc.selectionsStack.pop();

    // const matchingSels = latestSelections.filter((selection, index) =>
    const matchingSels = selections.filter((selection, index) =>
      // ModelEditSelection.isSameRange(selection, selections[index])
      ModelEditSelection.isSameRange(selection, latestSelections[index])
    );
    // and we're currently at the latest step in the history,
    if (matchingSels.length === selections.length) {
      // use the 2nd-last step in the history as the new selection set
      // doc.selections = last(doc.selectionsStack);
      doc.selections = last(doc.selectionsStack).slice(0, selections.length);
    }
  }
}

export function setSelectionStack(
  doc: EditableDocument,
  selections: ModelEditSelection[][] = [doc.selections]
) {
  doc.selectionsStack = selections;
}

export async function raiseSexp(
  doc: EditableDocument,
  start = doc.selections[0].anchor,
  end = doc.selections[0].active
) {
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
        return doc.model.edit(
          [new ModelEdit('changeRange', [startCursor.offsetStart, endCursor.offsetEnd, raised])],
          {
            selections: [
              new ModelEditSelection(
                isCaretTrailing ? startCursor.offsetStart + raised.length : startCursor.offsetStart
              ),
            ],
          }
        );
      }
    }
  }
}

export async function convolute(
  doc: EditableDocument,
  start = doc.selections[0].anchor,
  end = doc.selections[0].active
) {
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
              return doc.model.edit(
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
}

export async function transpose(
  doc: EditableDocument,
  left = doc.selections[0].anchor,
  right = doc.selections[0].active,
  newPosOffset: { fromLeft?: number; fromRight?: number } = {}
) {
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
        return doc.model.edit(
          [
            new ModelEdit('changeRange', [rightStart, rightEnd, leftText]),
            new ModelEdit('changeRange', [
              leftStart,
              leftEnd,
              rightText,
              [left, left],
              [newCursorPos, newCursorPos],
            ]),
          ],
          { selections: [new ModelEditSelection(newCursorPos)] }
        );
      }
    }
  }
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

export function isInPairsList(cursor: LispTokenCursor, pairForms: string[]): boolean {
  const probeCursor = cursor.clone();
  if (probeCursor.backwardList()) {
    const opening = probeCursor.getPrevToken().raw;
    if (opening.endsWith('{') && !opening.endsWith('#{')) {
      return true;
    }
    if (opening.endsWith('[')) {
      probeCursor.backwardUpList();
      probeCursor.backwardList();
      if (!probeCursor.getPrevToken().raw.endsWith('(')) {
        return false;
      }
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
export function currentSexpsRange(
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

export async function dragSexprBackward(
  doc: EditableDocument,
  pairForms = bindingForms,
  left = doc.selections[0].anchor,
  right = doc.selections[0].active
) {
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
    return doc.model.edit(
      [
        new ModelEdit('changeRange', [currentRange[0], currentRange[1], leftText]),
        new ModelEdit('changeRange', [backRange[0], backRange[1], currentText]),
      ],
      { selections: [new ModelEditSelection(backRange[0] + newPosOffset)] }
    );
  }
}

export async function dragSexprForward(
  doc: EditableDocument,
  pairForms = bindingForms,
  left = doc.selections[0].anchor,
  right = doc.selections[0].active
) {
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
    return doc.model.edit(
      [
        new ModelEdit('changeRange', [forwardRange[0], forwardRange[1], currentText]),
        new ModelEdit('changeRange', [currentRange[0], currentRange[1], rightText]),
      ],
      {
        selections: [
          new ModelEditSelection(
            currentRange[1] + (forwardRange[1] - currentRange[1]) - newPosOffset
          ),
        ],
      }
    );
  }
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
  p = doc.selections[0].active
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

export async function dragSexprBackwardUp(doc: EditableDocument, p = doc.selections[0].active) {
  const wsInfo = collectWhitespaceInfo(doc, p);
  const cursor = doc.getTokenCursor(p);
  const currentRange = cursor.rangeForCurrentForm(p);
  if (cursor.backwardList() && cursor.backwardUpList()) {
    const listStart = cursor.offsetStart;
    const newPosOffset = p - currentRange[0];
    const newCursorPos = listStart + newPosOffset;
    const listIndent = cursor.getToken().offset;
    let dragText: string, deleteEdit: ModelEdit<'deleteRange'>;
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
    return doc.model.edit(
      [
        deleteEdit,
        new ModelEdit('insertString', [listStart, dragText, [p, p], [newCursorPos, newCursorPos]]),
      ],
      {
        selections: [new ModelEditSelection(newCursorPos)],
        skipFormat: false,
        undoStopBefore: true,
      }
    );
  }
}

export async function dragSexprForwardDown(doc: EditableDocument, p = doc.selections[0].active) {
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
      return doc.model.edit(
        [
          new ModelEdit('insertString', [
            insertStart,
            insertText,
            [p, p],
            [newCursorPos, newCursorPos],
          ]),
          new ModelEdit('deleteRange', [currentRange[0], deleteLength]),
        ],
        {
          selections: [new ModelEditSelection(newCursorPos)],
          skipFormat: false,
          undoStopBefore: true,
        }
      );
    }
  }
}

export async function dragSexprForwardUp(doc: EditableDocument, p = doc.selections[0].active) {
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
    return doc.model.edit(
      [
        new ModelEdit('insertString', [listEnd, dragText, [p, p], [newCursorPos, newCursorPos]]),
        new ModelEdit('deleteRange', [deleteStart, deleteLength]),
      ],
      {
        selections: [new ModelEditSelection(newCursorPos)],
        skipFormat: false,
        undoStopBefore: true,
      }
    );
  }
}

export async function dragSexprBackwardDown(doc: EditableDocument, p = doc.selections[0].active) {
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
      return doc.model.edit(
        [
          new ModelEdit('deleteRange', [wsInfo.leftWsRange[0], deleteLength]),
          new ModelEdit('insertString', [
            insertStart,
            insertText,
            [p, p],
            [newCursorPos, newCursorPos],
          ]),
        ],
        {
          selections: [new ModelEditSelection(newCursorPos)],
          skipFormat: false,
          undoStopBefore: true,
        }
      );
      break;
    }
  }
}

/**
 * Checks if a semi-colon would break the structure of the document at the given position.
 * @returns The position where the structure would break, or false if it would not.
 */
export function _semiColonWouldBreakStructureWhere(
  doc: EditableDocument,
  p = doc.selections[0].active
): number | false {
  const startCursor = doc.getTokenCursor(p);
  if (startCursor.withinComment() || startCursor.withinString()) {
    return false;
  }
  const probeCursor = startCursor.clone();
  while (true) {
    probeCursor.forwardWhitespace(true);
    if (probeCursor.line !== startCursor.line || probeCursor.atEnd()) {
      return false; // at end of the starting line possibly in whitespace or comment
    }
    const offsetBeforeMoving = probeCursor.offsetStart;
    const moved = probeCursor.forwardSexp(true, true, true);
    if (probeCursor.line !== startCursor.line) {
      return offsetBeforeMoving; // the sexp in front ends on a different line
    }
    if (!moved) {
      return probeCursor.offsetStart; // inside a list ending on the same line
    }
  }
}

export async function insertSemiColon(doc: EditableDocument, p = doc.selections[0].active) {
  const wouldBreakWhere = _semiColonWouldBreakStructureWhere(doc, p);
  return wouldBreakWhere
    ? doc.model.edit(
        [
          new ModelEdit('insertString', [p, ';', [p, p], [p + 1, p + 1]]),
          new ModelEdit('insertString', [wouldBreakWhere, '\n', [p, p], [p + 1, p + 1]]),
        ],
        {
          selections: [new ModelEditSelection(p + 1)],
          skipFormat: false,
          undoStopBefore: true,
        }
      )
    : doc.model.edit([new ModelEdit('insertString', [p, ';', [p, p], [p + 1, p + 1]])], {
        selections: [new ModelEditSelection(p + 1)],
        skipFormat: true,
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

export async function addRichComment(
  doc: EditableDocument,
  p = doc.selections[0].active,
  contents?: string
) {
  const richComment = `(comment\n  ${
    contents ? adaptContentsToRichComment(contents) : ''
  }\n  :rcf)`;
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
      return doc.model.edit(
        [
          new ModelEdit('insertString', [
            newCursorPos,
            '',
            [newCursorPos, newCursorPos],
            [newCursorPos, newCursorPos],
          ]),
        ],
        {
          selections: [new ModelEditSelection(newCursorPos)],
          skipFormat: true,
          undoStopBefore: false,
        }
      );
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
  return doc.model.edit(
    [
      new ModelEdit('insertString', [
        insertStart,
        insertText,
        [insertStart, insertStart],
        [newCursorPos, newCursorPos],
      ]),
    ],
    {
      selections: [new ModelEditSelection(newCursorPos)],
      skipFormat: false,
      undoStopBefore: true,
    }
  );
}
