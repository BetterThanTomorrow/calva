/* Functions for getting text given only cursor-doc related input
 * Can be unit tested since vscode and stuff is not imported
*/

import { EditableDocument } from "../cursor-doc/model";

export type RangeAndText = [[number, number], string];

export function currentTopLevelFunction(doc: EditableDocument): RangeAndText {
    const defunCursor = doc.getTokenCursor(doc.selection.active);
    const defunStart = defunCursor.rangeForDefun(doc.selection.active)[0];
    const cursor = doc.getTokenCursor(defunStart);
    while (cursor.downList()) {
        cursor.forwardWhitespace();
        while (cursor.forwardSexp(true, true, true)) {
            cursor.forwardWhitespace();
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

function rangeOrStartOfFileToCursor(doc: EditableDocument, foldRange: [number, number], startFrom: number): RangeAndText {
    if (foldRange) {
        const closeBrackets: string[] = [];
        const bracketCursor = doc.getTokenCursor(doc.selection.active);
        bracketCursor.backwardWhitespace(true);
        const rangeEnd = bracketCursor.offsetStart;
        while (bracketCursor.offsetStart !== foldRange[1] && bracketCursor.forwardList() && bracketCursor.upList()) {
            closeBrackets.push(bracketCursor.getPrevToken().raw);
        }
        const range: [number, number] = [startFrom, rangeEnd];
        return [range, doc.model.getText(...range) + closeBrackets.join('')];
    }
    return [undefined, ''];
}

export function currentEnclosingForm(doc: EditableDocument): RangeAndText {
    const cursor = doc.getTokenCursor(doc.selection.active);
    const enclosingRange = cursor.rangeForList(1);
    return enclosingRange ? [enclosingRange, doc.model.getText(...enclosingRange)] : [undefined, ''];
}

export function currentEnclosingFormToCursor(doc: EditableDocument): RangeAndText {
    const cursor = doc.getTokenCursor(doc.selection.active);
    const enclosingRange = cursor.rangeForList(1);
    return rangeOrStartOfFileToCursor(doc, enclosingRange, enclosingRange[0]);
}


export function currentTopLevelFormToCursor(doc: EditableDocument): RangeAndText {
    const cursor = doc.getTokenCursor(doc.selection.active);
    const defunRange = cursor.rangeForDefun(doc.selection.active);
    return rangeOrStartOfFileToCursor(doc, defunRange, defunRange[0]);
}

export function startOfFileToCursor(doc: EditableDocument): RangeAndText {
    const cursor = doc.getTokenCursor(doc.selection.active);
    const defunRange = cursor.rangeForDefun(doc.selection.active, false);
    return rangeOrStartOfFileToCursor(doc, defunRange, 0);
}
