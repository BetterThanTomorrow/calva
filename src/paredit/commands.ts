import { EditableDocument, ModelEditDirectedRange } from '../cursor-doc/model';
import * as paredit from '../cursor-doc/paredit';

// MOVEMENT

export function forwardSexp(doc: EditableDocument, isMulti: boolean = false) {
  const selections = isMulti ? doc.selections : [doc.selections[0]];
  const ranges = selections.map((s) => paredit.forwardSexpRange(doc, s.end));
  paredit.moveToRangeRight(doc, ranges);
}
export function backwardSexp(doc: EditableDocument, isMulti: boolean = false) {
  const selections = isMulti ? doc.selections : [doc.selections[0]];
  const ranges = selections.map((s) => paredit.backwardSexpRange(doc, s.start));
  paredit.moveToRangeLeft(doc, ranges);
}
export function forwardDownSexp(doc: EditableDocument, isMulti: boolean = false) {
  const selections = isMulti ? doc.selections : [doc.selections[0]];
  const ranges = selections.map((s) => paredit.rangeToForwardDownList(doc, s.end));
  paredit.moveToRangeRight(doc, ranges);
}
export function backwardDownSexp(doc: EditableDocument, isMulti: boolean = false) {
  const selections = isMulti ? doc.selections : [doc.selections[0]];
  const ranges = selections.map((s) => paredit.rangeToBackwardDownList(doc, s.start));
  paredit.moveToRangeLeft(doc, ranges);
}
export function forwardUpSexp(doc: EditableDocument, isMulti: boolean = false) {
  const selections = isMulti ? doc.selections : [doc.selections[0]];
  const ranges = selections.map((s) => paredit.rangeToForwardUpList(doc, s.end));
  paredit.moveToRangeRight(doc, ranges);
}
export function backwardUpSexp(doc: EditableDocument, isMulti: boolean = false) {
  const selections = isMulti ? doc.selections : [doc.selections[0]];
  const ranges = selections.map((s) => paredit.rangeToBackwardUpList(doc, s.start));
  paredit.moveToRangeLeft(doc, ranges);
}
export function forwardSexpOrUp(doc: EditableDocument, isMulti: boolean = false) {
  const selections = isMulti ? doc.selections : [doc.selections[0]];
  const ranges = selections.map((s) => paredit.forwardSexpOrUpRange(doc, s.end));
  paredit.moveToRangeRight(doc, ranges);
}
export function backwardSexpOrUp(doc: EditableDocument, isMulti: boolean = false) {
  const selections = isMulti ? doc.selections : [doc.selections[0]];
  const ranges = selections.map((s) => paredit.backwardSexpOrUpRange(doc, s.end));
  paredit.moveToRangeLeft(doc, ranges);
}
export function closeList(doc: EditableDocument, isMulti: boolean = false) {
  const selections = isMulti ? doc.selections : [doc.selections[0]];
  const ranges = selections.map((s) => paredit.rangeToForwardList(doc, s.end));
  paredit.moveToRangeRight(doc, ranges);
}
export function openList(doc: EditableDocument, isMulti: boolean = false) {
  const selections = isMulti ? doc.selections : [doc.selections[0]];
  const ranges = selections.map((s) => paredit.rangeToBackwardList(doc, s.start));
  paredit.moveToRangeLeft(doc, ranges);
}

// SELECTION

export function selectCurrentForm(doc: EditableDocument, isMulti: boolean = false) {
  paredit.selectCurrentForm(doc, false, isMulti ? doc.selections : [doc.selections[0]]);
}
export function rangeForDefun(doc: EditableDocument, isMulti: boolean) {
  const selections = isMulti ? doc.selections : [doc.selections[0]];
  const ranges = selections.map((s) => paredit.rangeForDefun(doc, s.active));
  paredit.selectRange(doc, ranges);
}
export function sexpRangeExpansion(doc: EditableDocument, isMulti: boolean) {
  paredit.growSelection(doc, isMulti ? doc.selections : [doc.selections[0]]);
}
export function sexpRangeContraction(doc: EditableDocument, isMulti: boolean) {
  paredit.shrinkSelection(doc, isMulti ? doc.selections : [doc.selections[0]]);
}
export function selectForwardSexp(doc: EditableDocument, isMulti: boolean) {
  paredit.selectForwardSexp(doc, isMulti ? doc.selections : [doc.selections[0]]);
}
export function selectRight(doc: EditableDocument, isMulti: boolean) {
  paredit.selectRight(doc, isMulti ? doc.selections : [doc.selections[0]]);
}
/* export function selectLeft(doc: EditableDocument, isMulti: boolean) {
  paredit.selectLeft(doc, isMulti ? doc.selections : [doc.selections[0]]);
} */
export function selectBackwardSexp(doc: EditableDocument, isMulti: boolean) {
  paredit.selectBackwardSexp(doc, isMulti ? doc.selections : [doc.selections[0]]);
}
export function selectForwardDownSexp(doc: EditableDocument, isMulti: boolean) {
  paredit.selectForwardDownSexp(doc, isMulti ? doc.selections : [doc.selections[0]]);
}
export function selectBackwardDownSexp(doc: EditableDocument, isMulti: boolean) {
  paredit.selectBackwardDownSexp(doc, isMulti ? doc.selections : [doc.selections[0]]);
}
export function selectForwardUpSexp(doc: EditableDocument, isMulti: boolean) {
  paredit.selectForwardUpSexp(doc, isMulti ? doc.selections : [doc.selections[0]]);
}
export function selectForwardSexpOrUp(doc: EditableDocument, isMulti: boolean) {
  paredit.selectForwardSexpOrUp(doc, isMulti ? doc.selections : [doc.selections[0]]);
}
export function selectBackwardSexpOrUp(doc: EditableDocument, isMulti: boolean) {
  paredit.selectBackwardSexpOrUp(doc, isMulti ? doc.selections : [doc.selections[0]]);
}
export function selectBackwardUpSexp(doc: EditableDocument, isMulti: boolean) {
  paredit.selectBackwardUpSexp(doc, isMulti ? doc.selections : [doc.selections[0]]);
}
export function selectCloseList(doc: EditableDocument, isMulti: boolean) {
  paredit.selectCloseList(doc, isMulti ? doc.selections : [doc.selections[0]]);
}
export function selectOpenList(doc: EditableDocument, isMulti: boolean) {
  paredit.selectOpenList(doc, isMulti ? doc.selections : [doc.selections[0]]);
}

// DELETION

export async function killLeft(
  doc: EditableDocument,
  isMulti: boolean,
  onRange?: (doc: EditableDocument, range: ModelEditDirectedRange) => Promise<void>
) {
  // TODO: support multi-cursor
  const result = paredit.backwardHybridSexpRange(doc);
  await onRange?.(doc, result.range);
  return paredit.killRange(
    doc,
    result.range,
    doc.selections[0].anchor,
    doc.selections[0].active,
    result.editOptions
  );
}

// REWRAP

export function rewrapQuote(doc: EditableDocument, isMulti: boolean) {
  return paredit.rewrapSexpr(doc, '"', '"', isMulti ? doc.selections : [doc.selections[0]]);
}

export function rewrapSet(doc: EditableDocument, isMulti: boolean) {
  return paredit.rewrapSexpr(doc, '#{', '}', isMulti ? doc.selections : [doc.selections[0]]);
}

export function rewrapCurly(doc: EditableDocument, isMulti: boolean) {
  return paredit.rewrapSexpr(doc, '{', '}', isMulti ? doc.selections : [doc.selections[0]]);
}

export function rewrapSquare(doc: EditableDocument, isMulti: boolean) {
  return paredit.rewrapSexpr(doc, '[', ']', isMulti ? doc.selections : [doc.selections[0]]);
}

export function rewrapParens(doc: EditableDocument, isMulti: boolean) {
  return paredit.rewrapSexpr(doc, '(', ')', isMulti ? doc.selections : [doc.selections[0]]);
}
