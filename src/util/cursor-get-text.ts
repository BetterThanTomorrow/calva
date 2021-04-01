/* Functions for getting text given only a cursor
 * Can be unit tested since vscode and stuff is not imported 
 */
import { LispTokenCursor } from "../cursor-doc/token-cursor";

export type RangeAndText = [[number, number], string];

export function currentTopLevelFunction(tokenCursor: LispTokenCursor): RangeAndText {
    const defunCursor = tokenCursor.doc.getTokenCursor(0);
    const defunStart = defunCursor.rangeForDefun(tokenCursor.offsetStart)[0];
    const cursor = tokenCursor.doc.getTokenCursor(defunStart);
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
