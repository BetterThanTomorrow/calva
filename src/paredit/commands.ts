import { EditableDocument } from '../cursor-doc/model';
import * as paredit from '../cursor-doc/paredit';

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
