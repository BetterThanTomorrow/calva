import { ReplReadline } from "./readline";
import { validPair } from "./clojure-lexer";

export function wrapSexpr(doc: ReplReadline, open: string, close: string, start: number = doc.selectionStart, end: number = doc.selectionEnd) {
    let st = Math.min(start, end);
    let en = Math.max(start, end);
    let cursor = doc.getTokenCursor(en);
    if(cursor.withinString())
        throw new Error("Invalid context for paredit.wrapSexp");
    if(st == end) {
        cursor.forwardSexp()
        en = cursor.offsetStart;
        // NOTE: emacs leaves the selection as is, but it has no relation to what was selected after the transform.
        //       I have opted to clear it here.
        doc.selectionStart = doc.selectionEnd = en;
    }
    doc.model.insertString(en, close);
    doc.model.insertString(st, open);
}

export function splitSexp(doc: ReplReadline, start: number = doc.selectionEnd) {
    let cursor = doc.getTokenCursor(start);
    if(cursor.withinString()) {
        if(doc.model.getText(start-1, start+1, true) == '\\"') {
            doc.model.changeRange(start+1, start+1, "\" \"")
            doc.selectionStart = doc.selectionEnd = start+2;
        } else {
            doc.model.changeRange(start, start, "\" \"")
            doc.selectionStart = doc.selectionEnd = start+1;
        }
        return;
    }
    cursor.backwardWhitespace();
    start = cursor.offsetStart;
    let ws = cursor.clone();
    ws.forwardWhitespace()
    if(cursor.backwardList()) {
        let open = cursor.getPrevToken().raw;

        if(cursor.forwardList()) {
            let close = cursor.getToken().raw;
            doc.model.changeRange(start, ws.offsetStart, close+" "+open);
            doc.selectionStart = doc.selectionEnd = start + 1;
        }
    }
}

export function joinSexp(doc: ReplReadline, start: number = doc.selectionEnd) {
    let cursor = doc.getTokenCursor(start);
    cursor.backwardWhitespace();
    let open = cursor.getPrevToken();
    let beginning = cursor.offsetStart;
    if(cursor.withinString())
        throw new Error("Invalid context for paredit.joinSexp");
    if(open.type == "str-end" || open.type == "str") {
        cursor.forwardWhitespace();
        let close = cursor.getToken();
        let end = cursor.offsetStart;
        if((close.type == "str" || close.type == "str-start")) {
            doc.model.changeRange(beginning-1, end+1, "");
            doc.selectionStart = doc.selectionEnd = beginning-1;
        }
        
    } else if(open.type == "close") {
        cursor.forwardWhitespace();
        let close = cursor.getToken();
        let end = cursor.offsetStart;
        if(close.type == "open" && validPair(open.raw, close.raw)) {
            doc.model.changeRange(beginning-1, end+1, " ");
            doc.selectionStart = doc.selectionEnd = beginning;
        }
    }
}

export function spliceSexp(doc: ReplReadline, start: number = doc.selectionEnd) {
    let cursor = doc.getTokenCursor(start);
    // NOTE: this should unwrap the string, not throw.
    if(cursor.withinString())
        throw new Error("Invalid context for paredit.spliceSexp");
    
    cursor.backwardList()
    let open = cursor.getPrevToken();
    let beginning = cursor.offsetStart;
    if(open.type == "open") {
        cursor.forwardList();
        let close = cursor.getToken();
        let end = cursor.offsetStart;
        if(close.type == "close" && validPair(open.raw, close.raw)) {
            doc.model.changeRange(end, end+1, "");
            doc.model.changeRange(beginning-1, beginning, "");
            doc.selectionStart = doc.selectionEnd = start-1;
        }
    }
}

export function killBackwardList(doc: ReplReadline, start: number = doc.selectionEnd) {
    let cursor = doc.getTokenCursor(start);
    // NOTE: this should unwrap the string, not throw.
    if(cursor.withinString())
        throw new Error("Invalid context for paredit.killBackwardList");
    cursor.backwardList();
    doc.model.changeRange(cursor.offsetStart, start, "");
    return doc.selectionStart = doc.selectionEnd = cursor.offsetStart;
}

export function killForwardList(doc: ReplReadline, start: number = doc.selectionEnd) {
    let cursor = doc.getTokenCursor(start);
    let inComment = (cursor.getToken().type == "comment" && start > cursor.offsetStart) || cursor.getPrevToken().type == "comment";
    // NOTE: this should unwrap the string, not throw.
    if(cursor.withinString())
        throw new Error("Invalid context for paredit.killForwardList");
    cursor.forwardList();
    doc.model.changeRange(start, cursor.offsetStart, inComment ? "\n" : "");
    return doc.selectionStart = doc.selectionEnd = start;
}

export function spliceSexpKillingBackward(doc: ReplReadline, start: number = doc.selectionEnd) {
    spliceSexp(doc, killBackwardList(doc, start));
}

export function spliceSexpKillingForward(doc: ReplReadline, start: number = doc.selectionEnd) {
    spliceSexp(doc, killForwardList(doc, start));
}

export function forwardSlurpSexp(doc: ReplReadline, start: number = doc.selectionEnd) {
    let cursor = doc.getTokenCursor(start);
    cursor.forwardList();
    if(cursor.getToken().type == "close") {
        let offset = cursor.offsetStart;
        let close = cursor.getToken().raw;
        cursor.next();
        cursor.forwardSexp(true);
        cursor.backwardWhitespace(false);
        doc.model.changeRange(cursor.offsetStart, cursor.offsetStart, close);
        doc.model.changeRange(offset, offset+1, "");
    }
}

export function backwardSlurpSexp(doc: ReplReadline, start: number = doc.selectionEnd) {
    let cursor = doc.getTokenCursor(start);
    cursor.backwardList();
    let tk = cursor.getPrevToken();
    if(tk.type == "open") {
        let offset = cursor.clone().previous().offsetStart;
        let close = cursor.getPrevToken().raw;
        cursor.previous();
        cursor.backwardSexp(true);
        cursor.forwardWhitespace(false);
        doc.model.changeRange(offset, offset+tk.raw.length, "");
        doc.model.changeRange(cursor.offsetStart, cursor.offsetStart, close);
    }
}

export function forwardBarfSexp(doc: ReplReadline, start: number = doc.selectionEnd) {
    let cursor = doc.getTokenCursor(start);
    cursor.forwardList();
    if(cursor.getToken().type == "close") {
        let offset = cursor.offsetStart;
        let close = cursor.getToken().raw;
        cursor.backwardSexp(true);
        cursor.backwardWhitespace();
        doc.model.changeRange(offset, offset+1, "");
        doc.model.changeRange(cursor.offsetStart, cursor.offsetStart, close);
    }
}

export function backwardBarfSexp(doc: ReplReadline, start: number = doc.selectionEnd) {
    let cursor = doc.getTokenCursor(start);
    cursor.backwardList();
    let tk = cursor.getPrevToken();
    if(tk.type == "open") {
        cursor.previous();
        let offset = cursor.offsetStart;
        let close = cursor.getToken().raw;
        cursor.next();
        cursor.forwardSexp(true);
        cursor.forwardWhitespace(false);
        doc.model.changeRange(cursor.offsetStart, cursor.offsetStart, close);
        doc.model.changeRange(offset, offset+tk.raw.length, "");
    }
}

export function open(doc: ReplReadline, pair: string, start: number = doc.selectionEnd) {
    doc.insertString(pair);
    doc.selectionStart = doc.selectionEnd = start+1;
}

export function close(doc: ReplReadline, close: string, start: number = doc.selectionEnd) {
    let cursor = doc.getTokenCursor();
    cursor.forwardWhitespace(false);
    if(cursor.getToken().raw == close) {
        doc.model.changeRange(start, cursor.offsetStart, "");
        doc.selectionStart = doc.selectionEnd = start+1;
    } else {
        // one of two things are possible:
        if(cursor.forwardList()) {
            //   we are in a matched list, just jump to the end of it.
            doc.selectionStart = doc.selectionEnd = cursor.offsetEnd;
        } else {
            while(cursor.forwardSexp()) {}
            doc.model.changeRange(cursor.offsetEnd, cursor.offsetEnd, close)
            doc.selectionStart = doc.selectionEnd = cursor.offsetEnd+1;
        }
    }
}

const parenPair = new Set(["()", "[]", "{}", '""', '\\"'])
const openParen = new Set(["(", "[", "{", '"'])
const closeParen = new Set([")", "]", "}", '"'])

export function backspace(doc: ReplReadline, start: number = doc.selectionStart, end: number = doc.selectionEnd) {
    if(start != end) {
        doc.backspace();
    } else {
        if(doc.model.getText(start-3, start, true) == '\\""') {
            doc.selectionStart = doc.selectionEnd = start-1;
        } else if(doc.model.getText(start-2, start-1, true) == '\\') {
            doc.model.deleteRange(start-2, 2);
            doc.selectionStart = doc.selectionEnd = start-2;
        } else if(parenPair.has(doc.model.getText(start-1, start+1, true))) {
            doc.model.deleteRange(start-1, 2);
            doc.selectionStart = doc.selectionEnd = start-1;
        } else if(closeParen.has(doc.model.getText(start-1, start, true)) || openParen.has(doc.model.getText(start-1, start, true))) {
            doc.selectionStart = doc.selectionEnd = start-1;
        } else if(openParen.has(doc.model.getText(start-1, start+1, true)) || closeParen.has(doc.model.getText(start-1, start, true))) {
            doc.model.deleteRange(start-1, 2);
            doc.selectionStart = doc.selectionEnd = start-1;
        } else
            doc.backspace();
    }
}

export function deleteForward(doc: ReplReadline, start: number = doc.selectionStart, end: number = doc.selectionEnd) {
    if(start != end) {
        doc.delete();
    } else {
        if(parenPair.has(doc.model.getText(start, start+2, true))) {
            doc.model.deleteRange(start, 2);
        } else if(parenPair.has(doc.model.getText(start-1, start+1, true))) {
            doc.model.deleteRange(start-1, 2);
            doc.selectionStart = doc.selectionEnd = start-1;
        } else if(openParen.has(doc.model.getText(start, start+1, true)) || closeParen.has(doc.model.getText(start, start+1, true))) {
            doc.selectionStart = doc.selectionEnd = start+1;
        } else
            doc.delete();
    }
}

export function stringQuote(doc: ReplReadline, start: number = doc.selectionStart, end: number = doc.selectionEnd) {
    if(start != end) {
        doc.insertString('"');
    } else {
        let cursor = doc.getTokenCursor(start);
        if(cursor.withinString()) {
            // inside a string, let's be clever
            if(cursor.offsetEnd-1 == start && cursor.getToken().type == "str" || cursor.getToken().type == "str-end") {
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

export function growSelection(doc: ReplReadline, start: number = doc.selectionStart, end: number = doc.selectionEnd) {
    let startC = doc.getTokenCursor(start);
    let endC = doc.getTokenCursor(end);
    if(startC.equals(endC) && !startC.withinWhitespace()) {
        if(startC.getToken().type == "close") {
            if(startC.getPrevToken().type == "close") {
                startC.backwardList();
                doc.growSelectionStack.push([doc.selectionStart = startC.offsetStart, doc.selectionEnd = endC.offsetStart]);
            } else {
                endC = startC.previous();
                doc.growSelectionStack.push([doc.selectionStart = startC.offsetStart, doc.selectionEnd = endC.offsetEnd]);
            }
        } else if(startC.getToken().type == "open") {
            endC.forwardList();
            doc.growSelectionStack.push([doc.selectionStart = startC.offsetStart, doc.selectionEnd = endC.offsetStart]);
        } else {
            doc.growSelectionStack.push([doc.selectionStart = startC.offsetStart, doc.selectionEnd = startC.offsetEnd]);
        }
    } else {
        if(startC.getPrevToken().type == "open" && endC.getToken().type == "close") {
            startC.backwardList();
            startC.backwardUpList();
            endC.forwardList();
            doc.growSelectionStack.push([doc.selectionStart = startC.offsetStart, doc.selectionEnd = endC.offsetEnd]);
        } else {
            startC.backwardList();
            endC.forwardList();
            endC.previous();
            doc.growSelectionStack.push([doc.selectionStart = startC.offsetStart, doc.selectionEnd = endC.offsetEnd]);
        }
    }
}

export function shrinkSelection(doc: ReplReadline) {
    if(doc.growSelectionStack.length) {
        let [start, end] = doc.growSelectionStack.pop();
        if(start == doc.selectionStart && end == doc.selectionEnd && doc.growSelectionStack.length) {
            [doc.selectionStart, doc.selectionEnd] = doc.growSelectionStack[doc.growSelectionStack.length-1];
        } else {
            doc.growSelectionStack = [];
        }
    }
}

export function raiseSexp(doc: ReplReadline, start = doc.selectionStart, end = doc.selectionEnd) {
    if(start == end) {
        let cursor = doc.getTokenCursor(end);
        cursor.forwardWhitespace();
        let endCursor = cursor.clone();
        if(endCursor.forwardSexp()) {
            let raised = doc.model.getText(cursor.offsetStart, endCursor.offsetStart);
            cursor.backwardList();
            endCursor.forwardList();
            if(cursor.getPrevToken().type == "open") {
                cursor.previous();
                if(endCursor.getToken().type == "close") {
                    doc.model.changeRange(cursor.offsetStart, endCursor.offsetEnd, raised);
                    doc.selectionStart = doc.selectionEnd = cursor.offsetStart;
                }
            }
        }
    }
}

export function convolute(doc: ReplReadline, start = doc.selectionStart, end = doc.selectionEnd) {
    if(start == end) {
        let cursorStart = doc.getTokenCursor(end);
        let cursorEnd = cursorStart.clone();
        
        if(cursorStart.backwardList()) {
            if(cursorEnd.forwardList()) {
                let head = doc.model.getText(cursorStart.offsetStart, end);
                if(cursorStart.getPrevToken().type == "open") {
                    cursorStart.previous();
                    let headStart = cursorStart.clone();
                    
                    if(headStart.backwardList() && headStart.backwardUpList()) {
                        let headEnd = cursorStart.clone();
                        if(headEnd.forwardList() && cursorEnd.getToken().type == "close") {
                            doc.model.changeRange(headEnd.offsetEnd, headEnd.offsetEnd, ")");
                            doc.model.changeRange(cursorEnd.offsetStart, cursorEnd.offsetEnd, "");
                            doc.model.changeRange(cursorStart.offsetStart, end, "");
                            doc.model.changeRange(headStart.offsetStart, headStart.offsetStart, "("+head);
                        }
                    }
                }
            }
        }
    }
}
