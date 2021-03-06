import { LispTokenCursor } from "./token-cursor";

// context predicates

// TODO: give functions a more similar arg list

/**
 * Returns true if documentOffset is either at the first char of the token under the cursor, or
 * in the whitespace between the token and the first preceding EOL, otherwise false
 */
function cursorAtLineStartIncLeadingWhitespace(cursor: LispTokenCursor, documentOffset: number) {
    const cursorCopy = cursor.clone();
    let startOfLine = false;
    //  only at start if we're in ws, or at the 1st char of a non-ws sexp
    if (cursorCopy.getToken().type === 'ws' || cursorCopy.offsetStart >= documentOffset) {
        while (cursorCopy.getPrevToken().type === 'ws') {
            cursorCopy.previous();
        }
        startOfLine = cursorCopy.getPrevToken().type === 'eol';
    }

    return startOfLine;
}

/** 
 * Returns true if position is after the last char of the last lisp token on the line, including
 * any trailing whitespace or EOL, otherwise false
 */
function cursorAtLineEndIncTrailingWhitespace(tokenCursor: LispTokenCursor, line: string, position: number) {
    //  consider a multiline string as a single line
    if (tokenCursor.withinString()) {
        return false;
    }

    // don't consider commas as whitepace on comment lines
    const lastNonWSIndex = line.match(/\S(?=(\s*$))/)?.index;
    
    return position > lastNonWSIndex
}

export {
    cursorAtLineStartIncLeadingWhitespace,
    cursorAtLineEndIncTrailingWhitespace
}