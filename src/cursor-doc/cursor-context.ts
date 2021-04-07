import { LispTokenCursor } from "./token-cursor";

const allCursorContexts = ['calva:cursorInString', 'calva:cursorInComment', 'calva:cursorAtStartOfLine', 'calva:cursorAtEndOfLine', 'calva:cursorBeforeComment', 'calva:cursorAfterComment'] as const;

type CursorContext = typeof allCursorContexts[number];

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

function determineContexts(tokenCursor: LispTokenCursor, offset: number) {
    const contexts: CursorContext[] = [];

    if (cursorAtLineStartIncLeadingWhitespace(tokenCursor, offset)) {
        contexts.push('calva:cursorAtStartOfLine');
    } else if (cursorAtLineEndIncTrailingWhitespace(tokenCursor, tokenCursor.doc.getLineText(tokenCursor.line), tokenCursor.rowCol[1])) {
        contexts.push('calva:cursorAtEndOfLine');
    }

    if (tokenCursor.withinString()) {
        contexts.push('calva:cursorInString');
    } else if (tokenCursor.withinComment()) {
        contexts.push('calva:cursorInComment');
    }

    // Compound contexts 
    if (contexts.includes('calva:cursorInComment')) {
        if (contexts.includes('calva:cursorAtEndOfLine')) {
            tokenCursor.forwardWhitespace(false);
            if (tokenCursor.getToken().type != 'comment') {
                contexts.push('calva:cursorAfterComment');
            }
        } else if (contexts.includes('calva:cursorAtStartOfLine')) {
            tokenCursor.backwardWhitespace(false);
            if (tokenCursor.getPrevToken().type != 'comment') {
                contexts.push('calva:cursorBeforeComment');
            }
        }
    }

    return contexts;
}

export {
    allCursorContexts,
    CursorContext,
    cursorAtLineStartIncLeadingWhitespace,
    cursorAtLineEndIncTrailingWhitespace,
    determineContexts
}