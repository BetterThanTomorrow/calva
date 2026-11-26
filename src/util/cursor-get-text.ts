/* Functions for getting text given only cursor-doc related input
 * Can be unit tested since vscode and stuff is not imported
 */

import * as model from '../cursor-doc/model';
import * as paredit from '../cursor-doc/paredit';
import type { PareditConfig } from '../cursor-doc/paredit-config';

export type RangeAndText = [[number, number], string] | [undefined, string];

function rangeAndText(doc: model.EditableDocument, range?: [number, number]): RangeAndText {
  return range ? [range, doc.model.getText(...range)] : [undefined, ''];
}

/** As `rangeAndText`, but with the whole text of `doc` when there is no `range`: with no form to pick, as at the top level, the form is the whole document. */
function rangeAndTextElseDocument(
  doc: model.EditableDocument,
  range?: [number, number]
): RangeAndText {
  return range ? rangeAndText(doc, range) : [undefined, doc.model.getText(0, Infinity)];
}

const hasSelection = (doc: model.EditableDocument) =>
  doc.selections[0].start !== doc.selections[0].end;

export function currentForm(
  doc: model.EditableDocument,
  active: number = doc.selections[0].active
): RangeAndText {
  return rangeAndTextElseDocument(doc, doc.getTokenCursor(active).rangeForCurrentForm(active));
}

export function selectionText(doc: model.EditableDocument): RangeAndText {
  const { start, end } = doc.selections[0];
  return rangeAndText(doc, [start, end]);
}

export function selectionElseCurrentForm(doc: model.EditableDocument): RangeAndText {
  return hasSelection(doc) ? selectionText(doc) : currentForm(doc);
}

export function currentEnclosingForm(
  doc: model.EditableDocument,
  active: number = doc.selections[0].active
): RangeAndText {
  const cursor = doc.getTokenCursor(active);
  if (cursor.backwardList()) {
    cursor.backwardUpList();
    const start = cursor.offsetStart;
    if (cursor.forwardSexp()) {
      return rangeAndText(doc, [start, cursor.offsetStart]);
    }
  }
  return rangeAndTextElseDocument(doc);
}

export function currentPair(
  doc: model.EditableDocument,
  config?: PareditConfig,
  active: number = doc.selections[0].active
): RangeAndText {
  const cursor = doc.getTokenCursor(active);
  return paredit.isInPairsList(cursor, config)
    ? rangeAndText(doc, paredit.currentSexpsRange(doc, cursor, active, true, config))
    : [undefined, ''];
}

export function currentFunction(
  doc: model.EditableDocument,
  topLevel = false,
  active: number = doc.selections[0].active
): RangeAndText {
  const cursor = doc.getTokenCursor(active);
  if (topLevel) {
    cursor.set(doc.getTokenCursor(cursor.rangeForDefun(active)[1] - 1));
  }
  const [start, end] = cursor.getFunctionSexpRange();
  return start && end ? rangeAndText(doc, [start, end]) : [undefined, ''];
}

export function currentTopLevelDefined(
  doc: model.EditableDocument,
  active: number = doc.selections[0].active
): RangeAndText {
  const defunCursor = doc.getTokenCursor(active);
  const defunStart = defunCursor.rangeForDefun(active)[0];
  const cursor = doc.getTokenCursor(defunStart);
  while (cursor.downList()) {
    cursor.forwardWhitespace();
    while (cursor.forwardSexp(true, true, true)) {
      cursor.forwardWhitespace();
      // skip over metadata, if present
      while (cursor.getToken().raw.startsWith('^')) {
        cursor.forwardSexp(true, false, true);
        cursor.forwardWhitespace();
      }
      const symbol = cursor.getToken();
      if (symbol.type === 'id') {
        return [[cursor.offsetStart, cursor.offsetEnd], symbol.raw];
      } else if (symbol.type === 'open') {
        break;
      }
    }
  }
  return [undefined, ''];
}

export function currentTopLevelForm(
  doc: model.EditableDocument,
  active: number = doc.selections[0].active
): RangeAndText {
  const defunCursor = doc.getTokenCursor(active);
  return rangeAndTextElseDocument(doc, defunCursor.rangeForDefun(active));
}

function rangeToCursor(
  doc: model.EditableDocument,
  foldRange: [number, number],
  startFrom: number,
  active: number
): RangeAndText {
  if (foldRange) {
    const closeBrackets: string[] = [];
    const bracketCursor = doc.getTokenCursor(active);
    bracketCursor.backwardWhitespace(true);
    const rangeEnd = bracketCursor.offsetStart;
    while (
      bracketCursor.offsetStart !== foldRange[1] &&
      bracketCursor.forwardList() &&
      bracketCursor.upList()
    ) {
      closeBrackets.push(bracketCursor.getPrevToken().raw);
    }
    const range: [number, number] = [startFrom, rangeEnd];
    return [range, doc.model.getText(...range) + closeBrackets.join('')];
  }
  return [undefined, ''];
}

export function currentEnclosingFormToCursor(doc: model.EditableDocument): RangeAndText {
  const cursor = doc.getTokenCursor(doc.selections[0].active);
  const enclosingRange = cursor.rangeForList(1);
  return rangeToCursor(doc, enclosingRange, enclosingRange[0], doc.selections[0].active);
}

export function currentTopLevelFormToCursor(doc: model.EditableDocument): RangeAndText {
  const cursor = doc.getTokenCursor(doc.selections[0].active);
  const defunRange = cursor.rangeForDefun(doc.selections[0].active);
  return rangeToCursor(doc, defunRange, defunRange[0], doc.selections[0].active);
}

export function startOfFileToCursor(doc: model.EditableDocument): RangeAndText {
  const cursor = doc.getTokenCursor(doc.selections[0].active);
  const defunRange = cursor.rangeForDefun(doc.selections[0].active, false);
  return rangeToCursor(doc, defunRange, 0, doc.selections[0].active);
}

export function selectionAddingBrackets(doc: model.EditableDocument): RangeAndText {
  const [left, right] = [doc.selections[0].anchor, doc.selections[0].active].sort((a, b) => a - b);
  const cursor = doc.getTokenCursor(left);
  cursor.forwardSexp(true, true, true);
  const rangeEnd = cursor.offsetStart;
  return rangeToCursor(doc, [left, rangeEnd], left, right);
}

/** The text from the start of the list around `offset` to `offset`, by default the selection's start. */
export function head(doc: model.EditableDocument, offset?: number): RangeAndText {
  return rangeAndText(doc, paredit.rangeToBackwardList(doc, offset));
}

/** The text from `offset` to the end of the list around it, by default the selection's end. */
export function tail(doc: model.EditableDocument, offset?: number): RangeAndText {
  return rangeAndText(doc, paredit.rangeToForwardList(doc, offset));
}

/** The selection adding brackets when there is one, else the enclosing form to the cursor, as the evaluate to cursor command takes them. */
export function enclosingFormOrSelectionToCursor(doc: model.EditableDocument): RangeAndText {
  return hasSelection(doc) ? selectionAddingBrackets(doc) : currentEnclosingFormToCursor(doc);
}

/** The forms around the cursor of `doc`, by the names custom REPL commands substitute them by. */
export function currentClojureContext(doc: model.EditableDocument, config?: PareditConfig) {
  return {
    currentForm: currentForm(doc),
    currentPair: currentPair(doc, config),
    enclosingForm: currentEnclosingForm(doc),
    topLevelForm: currentTopLevelForm(doc),
    currentFn: currentFunction(doc),
    topLevelDefinedForm: currentTopLevelDefined(doc),
    topLevelFn: currentFunction(doc, true),
    head: head(doc),
    tail: tail(doc),
  };
}
