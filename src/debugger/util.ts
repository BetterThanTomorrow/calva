import { Token } from "../cursor-doc/clojure-lexer";
import { LispTokenCursor } from "../cursor-doc/token-cursor";

function moveCursorPastStringInList(tokenCursor: LispTokenCursor, s: string): void {

    const [listOffsetStart, listOffsetEnd] = tokenCursor.rangeForList(1);
    const text = tokenCursor.doc.getText(listOffsetStart, listOffsetEnd - 1);

    const stringIndexInList = text.indexOf(s);
    if (stringIndexInList !== -1) {
        const coorOffset = listOffsetStart + stringIndexInList;
        while (tokenCursor.offsetStart !== coorOffset) {
            tokenCursor.forwardSexp();
            tokenCursor.forwardWhitespace();
        }
        tokenCursor.forwardSexp();
    } else {
        throw "Cannot find string in list";
    }
}

function syntaxQuoteBegins(token: Token) {
    // Check if we just entered a syntax quote, since we have to account for how syntax quoted forms are read
    // `(. .) is read as (seq (concat (list .) (list .))).
    if (/.*\`(\[|\{|\()$/.test(token.raw)) {
        return true;
    }
    return false;
}

function syntaxQuoteEnds(token: Token) {
        // A syntax quote is ending - this happens if ~ or ~@ precedes a form
        if (token.raw.match(/~@?/)) {
        return true;
    }
    return false;
}

function listBegins(token: Token) {
    if(token.raw.endsWith('(')) {
        return true;
    }
    return false;
}

function moveTokenCursorToBreakpoint(tokenCursor: LispTokenCursor, debugResponse: any): LispTokenCursor {

    const errorMessage = "Error finding position of breakpoint";
    const [_, defunEnd] = tokenCursor.rangeForDefun(tokenCursor.offsetStart);
    let inSyntaxQuote = false;

    const coor = [...debugResponse.coor]; // Copy the array so we do not modify the one stored in state

    for (let i = 0; i < coor.length; i++) {
        while (!tokenCursor.downList(true)) {
            tokenCursor.next();
        }
        const previousToken = tokenCursor.getPrevToken();

        inSyntaxQuote = syntaxQuoteBegins(previousToken);

        if (syntaxQuoteEnds(previousToken)) {
            inSyntaxQuote = false;
        }

        if (inSyntaxQuote) {
            // Ignore this coor and move to the next
            i++;
            // Now we're inside the `concat` form, but we need to ignore the actual `concat` symbol
            i++;
            // Non-list seqs like `[] and `{} are read with an extra (apply vector ...) or (apply hash-map ...)
            if (!listBegins(previousToken)) {
                // Ignore this coor too
                i++;
            }
        }

        // #() expands to (fn* ([] ...)) and this is what coor is calculated with, so ignore this coor and move to the next
        if (previousToken.raw.endsWith('#(')) {
            i++;
        }

        // If coor is a string it represents a map key
        if (typeof coor[i] === 'string') {
            moveCursorPastStringInList(tokenCursor, coor[i]);
        } else {
            for (let k = 0; k < coor[i]; k++) {
                if (!tokenCursor.forwardSexp(true, true, true)) {
                    throw errorMessage;
                }
            }
        }
    }

    // Move past the target sexp
    if (!tokenCursor.forwardSexp(true, true, true)) {
        throw errorMessage;
    }

    // Make sure we're still inside the original instrumented form, otherwise something went wrong
    if (tokenCursor.offsetStart > defunEnd) {
        throw errorMessage;
    }

    return tokenCursor;
}

export {
    moveTokenCursorToBreakpoint
};