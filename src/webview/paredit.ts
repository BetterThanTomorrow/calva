import { validPair } from "./clojure-lexer";
import { ModelDocument } from "./model-document";

export function wrapSexpr(doc: ModelDocument, open: string, close: string, start: number = doc.selectionStart, end: number = doc.selectionEnd) {
    let st = Math.min(start, end);
    let en = Math.max(start, end);
    let cursor = doc.getTokenCursor(en);
    if (cursor.withinString())
        throw new Error("Invalid context for paredit.wrapSexp");
    if (st == en) {
        cursor.forwardSexp();
        // reset the end position
        en = cursor.offsetStart;
        // ensure that start is before end.
        st = Math.min(st, en);
        en = Math.max(st, en);
        // ensure to first insert the closing element.
        doc.model.insertString(en, close);
        doc.model.insertString(st, open);
        // NOTE: emacs leaves the selection as is, 
        //       but it has no relation to what was 
        //       selected after the transform.
        //       I have opted to clear it here.
        doc.selectionStart = doc.selectionEnd = st;
    } else {
        doc.insertString(open + doc.getSelection() + close);
        doc.selectionStart = (st + open.length)
        doc.selectionEnd = (en + open.length)
    }
}

export function splitSexp(doc: ModelDocument, start: number = doc.selectionEnd) {
    let cursor = doc.getTokenCursor(start);
    if (cursor.withinString()) {
        if (doc.model.getText(start - 1, start + 1, true) == '\\"') {
            doc.model.changeRange(start + 1, start + 1, "\" \"")
            doc.selectionStart = doc.selectionEnd = start + 2;
        } else {
            doc.model.changeRange(start, start, "\" \"")
            doc.selectionStart = doc.selectionEnd = start + 1;
        }
        return;
    }
    cursor.backwardWhitespace();
    start = cursor.offsetStart;
    let ws = cursor.clone();
    ws.forwardWhitespace()
    if (cursor.backwardList()) {
        let open = cursor.getPrevToken().raw;

        if (cursor.forwardList()) {
            let close = cursor.getToken().raw;
            doc.model.changeRange(start, ws.offsetStart, close + " " + open);
            doc.selectionStart = doc.selectionEnd = start + 1;
        }
    }
}

export function joinSexp(doc: ModelDocument, start: number = doc.selectionEnd) {
    let cursor = doc.getTokenCursor(start);
    cursor.backwardWhitespace();
    let open = cursor.getPrevToken();
    let beginning = cursor.offsetStart;
    if (cursor.withinString())
        throw new Error("Invalid context for paredit.joinSexp");
    if (open.type == "str-end" || open.type == "str") {
        cursor.forwardWhitespace();
        let close = cursor.getToken();
        let end = cursor.offsetStart;
        if ((close.type == "str" || close.type == "str-start")) {
            doc.model.changeRange(beginning - 1, end + 1, "");
            doc.selectionStart = doc.selectionEnd = beginning - 1;
        }

    } else if (open.type == "close") {
        cursor.forwardWhitespace();
        let close = cursor.getToken();
        let end = cursor.offsetStart;
        if (close.type == "open" && validPair(open.raw, close.raw)) {
            doc.model.changeRange(beginning - 1, end + 1, " ");
            doc.selectionStart = doc.selectionEnd = beginning;
        }
    }
}

export function spliceSexp(doc: ModelDocument, start: number = doc.selectionEnd) {
    let cursor = doc.getTokenCursor(start);
    // NOTE: this should unwrap the string, not throw.
    if (cursor.withinString())
        throw new Error("Invalid context for paredit.spliceSexp");

    cursor.backwardList()
    let open = cursor.getPrevToken();
    let beginning = cursor.offsetStart;
    if (open.type == "open") {
        cursor.forwardList();
        let close = cursor.getToken();
        let end = cursor.offsetStart;
        if (close.type == "close" && validPair(open.raw, close.raw)) {
            doc.model.changeRange(end, end + 1, "");
            doc.model.changeRange(beginning - 1, beginning, "");
            doc.selectionStart = doc.selectionEnd = start - 1;
        }
    }
}

export function killBackwardList(doc: ModelDocument, start: number = doc.selectionEnd) {
    let cursor = doc.getTokenCursor(start);
    // NOTE: this should unwrap the string, not throw.
    if (cursor.withinString())
        throw new Error("Invalid context for paredit.killBackwardList");
    cursor.backwardList();
    doc.model.changeRange(cursor.offsetStart, start, "");
    return doc.selectionStart = doc.selectionEnd = cursor.offsetStart;
}

export function killForwardList(doc: ModelDocument, start: number = doc.selectionEnd) {
    let cursor = doc.getTokenCursor(start);
    let inComment = (cursor.getToken().type == "comment" && start > cursor.offsetStart) || cursor.getPrevToken().type == "comment";
    // NOTE: this should unwrap the string, not throw.
    if (cursor.withinString())
        throw new Error("Invalid context for paredit.killForwardList");
    cursor.forwardList();
    doc.model.changeRange(start, cursor.offsetStart, inComment ? "\n" : "");
    return doc.selectionStart = doc.selectionEnd = start;
}

export function spliceSexpKillingBackward(doc: ModelDocument, start: number = doc.selectionEnd) {
    spliceSexp(doc, killBackwardList(doc, start));
}

export function spliceSexpKillingForward(doc: ModelDocument, start: number = doc.selectionEnd) {
    spliceSexp(doc, killForwardList(doc, start));
}

export function forwardSlurpSexp(doc: ModelDocument, start: number = doc.selectionEnd) {
    let cursor = doc.getTokenCursor(start);
    cursor.forwardList();
    if (cursor.getToken().type == "close") {
        let offset = cursor.offsetStart;
        let close = cursor.getToken().raw;
        cursor.next();
        cursor.forwardSexp(true);
        cursor.backwardWhitespace(false);
        doc.model.changeRange(cursor.offsetStart, cursor.offsetStart, close);
        doc.model.deleteRange(offset, 1);
    }
}

export function backwardSlurpSexp(doc: ModelDocument, start: number = doc.selectionEnd) {
    let cursor = doc.getTokenCursor(start);
    cursor.backwardList();
    let tk = cursor.getPrevToken();
    if (tk.type == "open") {
        let offset = cursor.clone().previous().offsetStart;
        let close = cursor.getPrevToken().raw;
        cursor.previous();
        cursor.backwardSexp(true);
        cursor.forwardWhitespace(false);
        doc.model.deleteRange(offset, tk.raw.length);
        doc.model.changeRange(cursor.offsetStart, cursor.offsetStart, close);
    }
}

export function forwardBarfSexp(doc: ModelDocument, start: number = doc.selectionEnd) {
    let cursor = doc.getTokenCursor(start);
    cursor.forwardList();
    if (cursor.getToken().type == "close") {
        let offset = cursor.offsetStart;
        let close = cursor.getToken().raw;
        cursor.backwardSexp(true);
        cursor.backwardWhitespace();
        doc.model.deleteRange(offset, 1);
        doc.model.changeRange(cursor.offsetStart, cursor.offsetStart, close);
    }
}

export function backwardBarfSexp(doc: ModelDocument, start: number = doc.selectionEnd) {
    let cursor = doc.getTokenCursor(start);
    cursor.backwardList();
    let tk = cursor.getPrevToken();
    if (tk.type == "open") {
        cursor.previous();
        let offset = cursor.offsetStart;
        let close = cursor.getToken().raw;
        cursor.next();
        cursor.forwardSexp(true);
        cursor.forwardWhitespace(false);
        doc.model.changeRange(cursor.offsetStart, cursor.offsetStart, close);
        doc.model.deleteRange(offset, tk.raw.length);
    }
}

export function open(doc: ModelDocument, open: string, close: string, start: number = doc.selectionEnd) {
    let [cs, ce] = [doc.selectionStart, doc.selectionEnd];
    doc.insertString(open + doc.getSelection() + close);
    doc.selectionStart = doc.selectionEnd = start + open.length;
    if (cs != ce) {
        doc.selectionStart = (cs + open.length)
        doc.selectionEnd = (ce + open.length)
    } else {
        doc.selectionStart = doc.selectionEnd = start + open.length;
    }
}

export function close(doc: ModelDocument, close: string, start: number = doc.selectionEnd) {
    let cursor = doc.getTokenCursor();
    cursor.forwardWhitespace(false);
    if (cursor.getToken().raw == close) {
        doc.model.changeRange(start, cursor.offsetStart, "");
        doc.selectionStart = doc.selectionEnd = start + close.length;
    } else {
        // one of two things are possible:
        if (cursor.forwardList()) {
            //   we are in a matched list, just jump to the end of it.
            doc.selectionStart = doc.selectionEnd = cursor.offsetEnd;
        } else {
            while (cursor.forwardSexp()) { }
            doc.model.changeRange(cursor.offsetEnd, cursor.offsetEnd, close)
            doc.selectionStart = doc.selectionEnd = cursor.offsetEnd + close.length;
        }
    }
}

const parenPair = new Set(["()", "[]", "{}", '""', '\\"'])
const openParen = new Set(["(", "[", "{", '"'])
const closeParen = new Set([")", "]", "}", '"'])

export function backspace(doc: ModelDocument, start: number = doc.selectionStart, end: number = doc.selectionEnd) {
    if (start != end) {
        doc.backspace();
    } else {
        if (doc.model.getText(start - 3, start, true) == '\\""') {
            doc.selectionStart = doc.selectionEnd = start - 1;
        } else if (doc.model.getText(start - 2, start - 1, true) == '\\') {
            doc.model.deleteRange(start - 2, 2);
            doc.selectionStart = doc.selectionEnd = start - 2;
        } else if (parenPair.has(doc.model.getText(start - 1, start + 1, true))) {
            doc.model.deleteRange(start - 1, 2);
            doc.selectionStart = doc.selectionEnd = start - 1;
        } else if (closeParen.has(doc.model.getText(start - 1, start, true)) || openParen.has(doc.model.getText(start - 1, start, true))) {
            doc.selectionStart = doc.selectionEnd = start - 1;
        } else if (openParen.has(doc.model.getText(start - 1, start + 1, true)) || closeParen.has(doc.model.getText(start - 1, start, true))) {
            doc.model.deleteRange(start - 1, 2);
            doc.selectionStart = doc.selectionEnd = start - 1;
        } else
            doc.backspace();
    }
}

export function deleteForward(doc: ModelDocument, start: number = doc.selectionStart, end: number = doc.selectionEnd) {
    if (start != end) {
        doc.delete();
    } else {
        if (parenPair.has(doc.model.getText(start, start + 2, true))) {
            doc.model.deleteRange(start, 2);
        } else if (parenPair.has(doc.model.getText(start - 1, start + 1, true))) {
            doc.model.deleteRange(start - 1, 2);
            doc.selectionStart = doc.selectionEnd = start - 1;
        } else if (openParen.has(doc.model.getText(start, start + 1, true)) || closeParen.has(doc.model.getText(start, start + 1, true))) {
            doc.selectionStart = doc.selectionEnd = start + 1;
        } else
            doc.delete();
    }
}

export function stringQuote(doc: ModelDocument, start: number = doc.selectionStart, end: number = doc.selectionEnd) {
    if (start != end) {
        doc.insertString('"');
    } else {
        let cursor = doc.getTokenCursor(start);
        if (cursor.withinString()) {
            // inside a string, let's be clever
            if (cursor.offsetEnd - 1 == start && cursor.getToken().type == "str" || cursor.getToken().type == "str-end") {
                doc.selectionStart = doc.selectionEnd = start + 1;
            } else {
                doc.model.changeRange(start, start, '"');
                doc.selectionStart = doc.selectionEnd = start + 1;
            }
        } else {
            doc.model.changeRange(start, start, '""');
            doc.selectionStart = doc.selectionEnd = start + 1;
        }
    }
}

export function growSelection(doc: ModelDocument, start: number = doc.selectionStart, end: number = doc.selectionEnd) {
    const startC = doc.getTokenCursor(start),
        endC = doc.getTokenCursor(end),
        emptySelection = startC.equals(endC);

    if (emptySelection) {
        const currentFormC = startC.clone();
        if (currentFormC.moveToCurrentForm()) {
            if (!currentFormC.previousIsWhiteSpace() && currentFormC.getPrevToken().type != 'open') { // current form to the left
                const leftOfCurrentForm = currentFormC.clone();
                leftOfCurrentForm.backwardSexp();
                growSelectionStack(doc, [leftOfCurrentForm.offsetStart, currentFormC.offsetStart]);
            } else {
                const prevCurrentFormC = currentFormC.clone();
                prevCurrentFormC.previous();
                if (prevCurrentFormC.isWhiteSpace() || prevCurrentFormC.getToken().type == 'open') { // current form to the right
                    const rightOfCurrentForm = currentFormC.clone();
                    rightOfCurrentForm.forwardSexp();
                    growSelectionStack(doc, [currentFormC.offsetStart, rightOfCurrentForm.offsetStart]);
                } else { // cursor withing current ”solid” form
                    const leftOfCurrentForm = currentFormC.clone(),
                        rightOfCurrentForm = currentFormC.clone();
                    leftOfCurrentForm.backwardSexp();
                    rightOfCurrentForm.forwardSexp();
                    growSelectionStack(doc, [prevCurrentFormC.offsetStart, rightOfCurrentForm.offsetStart]);
                }
            }
        } else console.log("no move")
    } else {
        if (startC.getPrevToken().type == "open" && endC.getToken().type == "close") {
            startC.backwardList();
            startC.backwardUpList();
            endC.forwardList();
            growSelectionStack(doc, [startC.offsetStart, endC.offsetEnd]);
        } else {
            if (startC.backwardList()) {
                // we are in an sexpr.
                endC.forwardList();
                endC.previous();
            } else {
                if (startC.backwardDownList()) {
                    startC.backwardList();
                    if (emptySelection) {
                        endC.set(startC);
                        endC.forwardList();
                        endC.next();
                    }
                    startC.previous();
                } else if (startC.downList()) {
                    if (emptySelection) {
                        endC.set(startC);
                        endC.forwardList();
                        endC.next();
                    }
                    startC.previous();
                }
            }
            growSelectionStack(doc, [startC.offsetStart, endC.offsetEnd]);
        }
    }
}

function growSelectionStack(doc: ModelDocument, range: [number, number]) {
    const [start, end] = range;
    if (doc.growSelectionStack.length > 0) {
        const [prevStart, prevEnd] = doc.growSelectionStack[doc.growSelectionStack.length - 1];
        if (!(doc.selectionStart == prevStart && doc.selectionEnd == prevEnd)) {
            doc.growSelectionStack = [[doc.selectionStart, doc.selectionEnd]];
        }
    } else {
        doc.growSelectionStack = [[doc.selectionStart, doc.selectionEnd]];
    }
    doc.growSelectionStack.push(range);
    [doc.selectionStart, doc.selectionEnd] = [start, end];
}

export function shrinkSelection(doc: ModelDocument) {
    if (doc.growSelectionStack.length) {
        let [stackStart, stackEnd] = doc.growSelectionStack.pop();
        if (doc.growSelectionStack.length && stackStart == doc.selectionStart && stackEnd == doc.selectionEnd) {
            [doc.selectionStart, doc.selectionEnd] = doc.growSelectionStack[doc.growSelectionStack.length - 1];
        }
    }
}

export function raiseSexp(doc: ModelDocument, start = doc.selectionStart, end = doc.selectionEnd) {
    if (start == end) {
        let cursor = doc.getTokenCursor(end);
        cursor.forwardWhitespace();
        let endCursor = cursor.clone();
        if (endCursor.forwardSexp()) {
            let raised = doc.model.getText(cursor.offsetStart, endCursor.offsetStart);
            cursor.backwardList();
            endCursor.forwardList();
            if (cursor.getPrevToken().type == "open") {
                cursor.previous();
                if (endCursor.getToken().type == "close") {
                    doc.model.changeRange(cursor.offsetStart, endCursor.offsetEnd, raised);
                    doc.selectionStart = doc.selectionEnd = cursor.offsetStart;
                }
            }
        }
    }
}

export function convolute(doc: ModelDocument, start = doc.selectionStart, end = doc.selectionEnd) {
    if (start == end) {
        let cursorStart = doc.getTokenCursor(end);
        let cursorEnd = cursorStart.clone();

        if (cursorStart.backwardList()) {
            if (cursorEnd.forwardList()) {
                let head = doc.model.getText(cursorStart.offsetStart, end);
                if (cursorStart.getPrevToken().type == "open") {
                    cursorStart.previous();
                    let headStart = cursorStart.clone();

                    if (headStart.backwardList() && headStart.backwardUpList()) {
                        let headEnd = cursorStart.clone();
                        if (headEnd.forwardList() && cursorEnd.getToken().type == "close") {
                            doc.model.changeRange(headEnd.offsetEnd, headEnd.offsetEnd, ")");
                            doc.model.changeRange(cursorEnd.offsetStart, cursorEnd.offsetEnd, "");
                            doc.model.changeRange(cursorStart.offsetStart, end, "");
                            doc.model.changeRange(headStart.offsetStart, headStart.offsetStart, "(" + head);
                        }
                    }
                }
            }
        }
    }
}
