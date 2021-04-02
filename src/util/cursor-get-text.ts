/* Functions for getting text given only cursor-doc related input
 * Can be unit tested since vscode and stuff is not imported 
*/

import { LispTokenCursor } from "../cursor-doc/token-cursor";
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
