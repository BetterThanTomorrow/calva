/* Functions for getting text given only cursor-doc related input
 * Can be unit tested since vscode and stuff is not imported
 */

import { EditableDocument, StringDocument } from '../cursor-doc/model';

export type RangeAndText = [[number, number], string] | [undefined, ''];

export function currentTopLevelDefined(
  doc: EditableDocument,
  active: number = doc.selection.active
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

export function currentTopLevelForm(doc: EditableDocument): RangeAndText {
  const defunCursor = doc.getTokenCursor(doc.selection.active);
  const defunRange = defunCursor.rangeForDefun(doc.selection.active);
  return defunRange ? [defunRange, doc.model.getText(...defunRange)] : [undefined, ''];
}

function rangeToCursor(
  doc: EditableDocument,
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

export function currentEnclosingFormToCursor(doc: EditableDocument): RangeAndText {
  const cursor = doc.getTokenCursor(doc.selection.active);
  const enclosingRange = cursor.rangeForList(1);
  return rangeToCursor(doc, enclosingRange, enclosingRange[0], doc.selection.active);
}

export function currentTopLevelFormToCursor(doc: EditableDocument): RangeAndText {
  const cursor = doc.getTokenCursor(doc.selection.active);
  const defunRange = cursor.rangeForDefun(doc.selection.active);
  return rangeToCursor(doc, defunRange, defunRange[0], doc.selection.active);
}

export function startOfFileToCursor(doc: EditableDocument): RangeAndText {
  const cursor = doc.getTokenCursor(doc.selection.active);
  const defunRange = cursor.rangeForDefun(doc.selection.active, false);
  return rangeToCursor(doc, defunRange, 0, doc.selection.active);
}

export function selectionAddingBrackets(doc: EditableDocument): RangeAndText {
  const [left, right] = [doc.selection.anchor, doc.selection.active].sort((a, b) => a - b);
  const cursor = doc.getTokenCursor(left);
  cursor.forwardSexp(true, true, true);
  const rangeEnd = cursor.offsetStart;
  return rangeToCursor(doc, [left, rangeEnd], left, right);
}
