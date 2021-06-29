/* Functions for getting text given only cursor-doc related input
 * Can be unit tested since vscode and stuff is not imported
*/

import { EditableDocument } from "../cursor-doc/model";

export type RangeAndText = [[number, number], string];

export function currentTopLevelFunction(doc: EditableDocument): RangeAndText {
    const defunCursor = doc.getTokenCursor(0);
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
    const defunCursor = doc.getTokenCursor(0);
    const defunRange = defunCursor.rangeForDefun(doc.selection.active);
    return defunRange ? [defunRange, doc.model.getText(...defunRange)] : [undefined, ''];
}

function topLevelFormOrStartOfFileToCursor(doc: EditableDocument, useTopLevelForm: boolean): RangeAndText {
    const defunCursor = doc.getTokenCursor(0);
    const defunRange = defunCursor.rangeForDefun(doc.selection.active, 0, !useTopLevelForm);
    if (defunRange) {
        const closeBrackets: string[] = [];
        const bracketCursor = doc.getTokenCursor(doc.selection.active);
        bracketCursor.backwardWhitespace(true);
        const rangeEnd = bracketCursor.offsetStart;
        while (bracketCursor.offsetStart !== defunRange[1] && bracketCursor.forwardList() && bracketCursor.upList()) {
            closeBrackets.push(bracketCursor.getPrevToken().raw);
        }
        const range: [number, number] = [useTopLevelForm ? defunRange[0] : 0, rangeEnd];
        return [range, doc.model.getText(...range) + closeBrackets.join('')];
    }
    return [undefined, ''];
}


export function currentTopLevelFormToCursor(doc: EditableDocument): RangeAndText {
    return topLevelFormOrStartOfFileToCursor(doc, true);
}

export function startOfFileToCursor(doc: EditableDocument): RangeAndText {
    return topLevelFormOrStartOfFileToCursor(doc, false);
}
