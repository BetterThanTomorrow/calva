import { validPair } from "./clojure-lexer";
import { ModelEdit, EditableDocument, emptySelectionOption } from "./model";

// NB: doc.model.edit returns a Thenable, so that the vscode Editor can ccompose commands.
// But don't put such chains in this module because that won't work in the repl-console.
// In the repl-console, compose commands just by performing them in succession, making sure
// you provide selecions, old and new.

export function killRange(doc: EditableDocument, range: [number, number]) {
    doc.model.edit([
        new ModelEdit('deleteRange', [range[0], range[1] - range[0]])
    ], { selection: emptySelectionOption(range[0]) });
}

export function moveToRangeStart(doc: EditableDocument, range: [number, number]) {
    doc.selection = emptySelectionOption(range[0]);
}

export function moveToRangeEnd(doc: EditableDocument, range: [number, number]) {
    doc.selection = emptySelectionOption(range[1]);
}

export function selectRange(doc: EditableDocument, range: [number, number]) {
    doc.selection = { anchor: range[0], active: range[1] };
}

export function selectRangeFromSelectionStart(doc: EditableDocument, range: [number, number]) {
    doc.selection = { anchor: doc.selectionStart, active: range[1] };
}

export function selectRangeFromSelectionEnd(doc: EditableDocument, range: [number, number]) {
    doc.selection = { anchor: doc.selectionEnd, active: range[0] };
}


/**
 * Gets the range for the ”current” top level form
 * @see ListTokenCursor.rangeForDefun 
 */
export function rangeForDefun(doc: EditableDocument, offset: number = doc.selectionStart, start: number = 0): [number, number] {
    const cursor = doc.getTokenCursor(start);
    return cursor.rangeForDefun(offset);
}

export function rangeToForwardSexp(doc: EditableDocument, offset: number = doc.selectionStart): [number, number] {
    const cursor = doc.getTokenCursor(offset);
    cursor.forwardWhitespace();
    if (cursor.forwardSexp()) {
        return [offset, cursor.offsetStart];
    } else {
        return [offset, offset];
    }
}

export function rangeToBackwardSexp(doc: EditableDocument, offset: number = doc.selectionStart): [number, number] {
    const cursor = doc.getTokenCursor(offset);
    if (!cursor.isWhiteSpace() && cursor.offsetStart < offset) {
        // This is because cursor.backwardSexp() can't move backwards when "on" the first sexp inside a list
        // TODO: Try to fix this in LispTokenCursor instead.
        cursor.forwardSexp();
    }
    cursor.backwardWhitespace();
    if (cursor.backwardSexp()) {
        return [cursor.offsetStart, offset];
    } else {
        return [offset, offset];
    }
}

export function rangeToForwardUpList(doc: EditableDocument, offset: number = doc.selectionStart): [number, number] {
    const cursor = doc.getTokenCursor(offset);
    cursor.forwardList();
    if (cursor.upList()) {
        return [offset, cursor.offsetStart];
    } else {
        return [offset, offset];
    }
}

export function rangeToBackwardUpList(doc: EditableDocument, offset: number = doc.selectionStart): [number, number] {
    const cursor = doc.getTokenCursor(offset);
    cursor.backwardList();
    if (cursor.backwardUpList()) {
        return [cursor.offsetStart, offset];
    } else {
        return [offset, offset];
    }
}

export function rangeToForwardDownList(doc: EditableDocument, offset: number = doc.selectionStart): [number, number] {
    const cursor = doc.getTokenCursor(offset);
    do {
        cursor.forwardWhitespace();
        if (cursor.getToken().type === 'open') {
            break;
        }
    } while (cursor.forwardSexp());
    if (cursor.downList()) {
        return [offset, cursor.offsetStart];
    } else {
        return [offset, offset];
    }
}

export function rangeToBackwardDownList(doc: EditableDocument, offset: number = doc.selectionStart): [number, number] {
    const cursor = doc.getTokenCursor(offset);
    do {
        cursor.backwardWhitespace();
        if (cursor.getPrevToken().type === 'close') {
            break;
        }
    } while (cursor.backwardSexp());
    if (cursor.backwardDownList()) {
        return [cursor.offsetStart, offset];
    } else {
        return [offset, offset];
    }
}

export function rangeToForwardList(doc: EditableDocument, offset: number = doc.selectionStart): [number, number] {
    const cursor = doc.getTokenCursor(offset);
    if (cursor.forwardList()) {
        return [offset, cursor.offsetStart];
    } else {
        return [offset, offset];
    }
}

export function rangeToBackwardList(doc: EditableDocument, offset: number = doc.selectionStart): [number, number] {
    const cursor = doc.getTokenCursor(offset);
    if (cursor.backwardList()) {
        return [cursor.offsetStart, offset];
    } else {
        return [offset, offset];
    }
}

export function wrapSexpr(doc: EditableDocument, open: string, close: string, start: number = doc.selectionStart, end: number = doc.selectionEnd): Thenable<boolean> {
    const cursor = doc.getTokenCursor(end);
    if (start == end) { // No selection
        const currentFormRange = cursor.rangeForCurrentForm(start);
        if (currentFormRange) {
            const range = currentFormRange;
            return doc.model.edit([
                new ModelEdit('insertString', [range[1], close]),
                new ModelEdit('insertString', [range[0], open])
            ], { selection: emptySelectionOption(start + open.length) });
        }
    } else { // there is a selection
        const range = [Math.min(start, end), Math.max(start, end)];
        return doc.model.edit([
            new ModelEdit('insertString', [range[1], close]),
            new ModelEdit('insertString', [range[0], open])
        ], { selection: { anchor: start + open.length, active: end + open.length } });
    }
}

export function splitSexp(doc: EditableDocument, start: number = doc.selectionEnd) {
    let cursor = doc.getTokenCursor(start);
    if (cursor.withinString()) {
        if (doc.model.getText(start - 1, start + 1, true) == '\\"') {
            doc.model.edit([
                new ModelEdit('changeRange', [start + 1, start + 1, "\" \""])
            ], { selection: emptySelectionOption(start + 2 ) });
        } else {
            doc.model.edit([
                new ModelEdit('changeRange', [start, start, "\" \""])
            ], { selection: emptySelectionOption(start + 2 ) });
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
            doc.model.edit([
                new ModelEdit('changeRange', [start, ws.offsetStart, close + " " + open])
            ], { selection: emptySelectionOption(start + 1 ) });
        }
    }
}

/**
 * If `start` is between two strings or two lists of the same type: join them. Otherwise do nothing.
 * @param doc 
 * @param start 
 */
export function joinSexp(doc: EditableDocument, start: number = doc.selectionEnd): Thenable<boolean> {
    let cursor = doc.getTokenCursor(start);
    cursor.backwardWhitespace();
    const prevToken = cursor.getPrevToken(),
        prevEnd = cursor.offsetStart;
    if (['close', 'str-end', 'str'].includes(prevToken.type)) {
        cursor.forwardWhitespace();
        const nextToken = cursor.getToken(),
            nextStart = cursor.offsetStart;
        if (validPair(nextToken.raw[0], prevToken.raw[prevToken.raw.length - 1])) {
            doc.selectionStart = doc.selectionEnd = prevEnd - 1;
            return doc.model.edit([
                new ModelEdit('changeRange', [prevEnd - 1, nextStart + 1, prevToken.type === 'close' ? " " : ""])
            ], { selection: emptySelectionOption(prevEnd - 1) });
        }
    }
}

export function spliceSexp(doc: EditableDocument, start: number = doc.selectionEnd, undoStopBefore = true): Thenable<boolean> {
    let cursor = doc.getTokenCursor(start);
    // TODO: this should unwrap the string, not the enclosing list.

    cursor.backwardList()
    let open = cursor.getPrevToken();
    let beginning = cursor.offsetStart;
    if (open.type == "open") {
        cursor.forwardList();
        let close = cursor.getToken();
        let end = cursor.offsetStart;
        if (close.type == "close" && validPair(open.raw, close.raw)) {
            return doc.model.edit([
                new ModelEdit('changeRange', [end, end + 1, ""]),
                new ModelEdit('changeRange', [beginning - 1, beginning, ""])
            ], { undoStopBefore, selection: emptySelectionOption(start - 1) });
        }
    }
}

export function killBackwardList(doc: EditableDocument, start: number = doc.selectionEnd): Thenable<boolean> {
    let cursor = doc.getTokenCursor(start);
    // NOTE: this should unwrap the string, not throw.
    if (cursor.withinString())
        throw new Error("Invalid context for paredit.killBackwardList");
    cursor.backwardList();
    return doc.model.edit([
        new ModelEdit('changeRange', [cursor.offsetStart, start, "", [start, start], [cursor.offsetStart, cursor.offsetStart]])
    ], { selection: emptySelectionOption(cursor.offsetStart) });
}

export function killForwardList(doc: EditableDocument, start: number = doc.selectionEnd): Thenable<boolean> {
    let cursor = doc.getTokenCursor(start);
    let inComment = (cursor.getToken().type == "comment" && start > cursor.offsetStart) || cursor.getPrevToken().type == "comment";
    // NOTE: this should unwrap the string, not throw.
    if (cursor.withinString())
        throw new Error("Invalid context for paredit.killForwardList");
    cursor.forwardList();
    return doc.model.edit([
        new ModelEdit('changeRange', [start, cursor.offsetStart, inComment ? "\n" : "", [start, start], [start, start]])
    ], { selection: emptySelectionOption(start)});
}

export function forwardSlurpSexp(doc: EditableDocument, start: number = doc.selectionEnd) {
    let cursor = doc.getTokenCursor(start);
    cursor.forwardList();
    if (cursor.getToken().type == "close") {
        let offset = cursor.offsetStart;
        let close = cursor.getToken().raw;
        cursor.next();
        cursor.forwardSexp();
        cursor.backwardWhitespace(false);
        doc.model.edit([
            new ModelEdit('changeRange', [cursor.offsetStart, cursor.offsetStart, close]),
            new ModelEdit('deleteRange', [offset, 1])
        ], {});
    }
}

export function backwardSlurpSexp(doc: EditableDocument, start: number = doc.selectionEnd) {
    let cursor = doc.getTokenCursor(start);
    cursor.backwardList();
    let tk = cursor.getPrevToken();
    if (tk.type == "open") {
        let offset = cursor.clone().previous().offsetStart;
        let close = cursor.getPrevToken().raw;
        cursor.previous();
        cursor.backwardSexp(true);
        cursor.forwardWhitespace(false);
        doc.model.edit([
            new ModelEdit('deleteRange', [offset, tk.raw.length]),
            new ModelEdit('changeRange', [cursor.offsetStart, cursor.offsetStart, close])
        ], {});
    }
}

export function forwardBarfSexp(doc: EditableDocument, start: number = doc.selectionEnd) {
    const cursor = doc.getTokenCursor(start);
    cursor.forwardList();
    if (cursor.getToken().type == "close") {
        const offset = cursor.offsetStart,
            close = cursor.getToken().raw;
        cursor.backwardSexp(true);
        cursor.backwardWhitespace();
        doc.model.edit([
            new ModelEdit('deleteRange', [offset, close.length]),
            new ModelEdit('insertString', [cursor.offsetStart, close])
        ], start >= cursor.offsetStart ? {selection: emptySelectionOption(cursor.offsetStart) } : {});
    }
}

export function backwardBarfSexp(doc: EditableDocument, start: number = doc.selectionEnd) {
    let cursor = doc.getTokenCursor(start);
    cursor.backwardList();
    let tk = cursor.getPrevToken();
    if (tk.type == "open") {
        cursor.previous();
        let offset = cursor.offsetStart;
        let close = cursor.getToken().raw;
        cursor.next();
        cursor.forwardSexp();
        cursor.forwardWhitespace(false);
        doc.model.edit([
            new ModelEdit('changeRange', [cursor.offsetStart, cursor.offsetStart, close]),
            new ModelEdit('deleteRange', [offset, tk.raw.length])
        ], start <= cursor.offsetStart ? {selection: emptySelectionOption(cursor.offsetStart) } : {});
    }
}

export function open(doc: EditableDocument, open: string, close: string, start: number = doc.selectionEnd) {
    let [cs, ce] = [doc.selectionStart, doc.selectionEnd];
    doc.insertString(open + doc.getSelectionText() + close);
    doc.selectionStart = doc.selectionEnd = start + open.length;
    if (cs != ce) {
        doc.selectionStart = (cs + open.length)
        doc.selectionEnd = (ce + open.length)
    } else {
        doc.selectionStart = doc.selectionEnd = start + open.length;
    }
}

export function close(doc: EditableDocument, close: string, start: number = doc.selectionEnd) {
    let cursor = doc.getTokenCursor();
    cursor.forwardWhitespace(false);
    if (cursor.getToken().raw == close) {
        doc.model.edit([
            new ModelEdit('changeRange', [start, cursor.offsetStart, ""])
        ], { selection: emptySelectionOption(start + close.length) });
    } else {
        // one of two things are possible:
        if (cursor.forwardList()) {
            //   we are in a matched list, just jump to the end of it.
            doc.selectionStart = doc.selectionEnd = cursor.offsetEnd;
        } else {
            while (cursor.forwardSexp()) { }
            doc.model.edit([
                new ModelEdit('changeRange', [cursor.offsetEnd, cursor.offsetEnd, close])
            ], { selection: emptySelectionOption(cursor.offsetEnd + close.length) });
        }
    }
}

const parenPair = new Set(["()", "[]", "{}", '""', '\\"'])
const openParen = new Set(["(", "[", "{", '"'])
const closeParen = new Set([")", "]", "}", '"'])

export function backspace(doc: EditableDocument, start: number = doc.selectionStart, end: number = doc.selectionEnd) {
    if (start != end) {
        doc.backspace();
    } else {
        if (doc.model.getText(start - 3, start, true) == '\\""') {
            doc.selectionStart = doc.selectionEnd = start - 1;
        } else if (doc.model.getText(start - 2, start - 1, true) == '\\') {
            doc.model.edit([
                new ModelEdit('deleteRange', [start - 2, 2])
            ], { selection: emptySelectionOption(start - 2) });
        } else if (parenPair.has(doc.model.getText(start - 1, start + 1, true))) {
            doc.model.edit([
                new ModelEdit('deleteRange', [start - 1, 2])
            ], { selection: emptySelectionOption(start - 1) });
        } else if (closeParen.has(doc.model.getText(start - 1, start, true)) || openParen.has(doc.model.getText(start - 1, start, true))) {
            doc.selectionStart = doc.selectionEnd = start - 1;
        } else if (openParen.has(doc.model.getText(start - 1, start + 1, true)) || closeParen.has(doc.model.getText(start - 1, start, true))) {
            doc.model.edit([
                new ModelEdit('deleteRange', [start - 1, 2])
            ], { selection: emptySelectionOption(start - 1) });
        } else
            doc.backspace();
    }
}

export function deleteForward(doc: EditableDocument, start: number = doc.selectionStart, end: number = doc.selectionEnd) {
    if (start != end) {
        doc.delete();
    } else {
        if (parenPair.has(doc.model.getText(start, start + 2, true))) {
            doc.model.edit([
                new ModelEdit('deleteRange', [start, 2])
            ], {});
        } else if (parenPair.has(doc.model.getText(start - 1, start + 1, true))) {
            doc.model.edit([
                new ModelEdit('deleteRange', [start - 1, 2])
            ], { selection: emptySelectionOption(start - 1) });
        } else if (openParen.has(doc.model.getText(start, start + 1, true)) || closeParen.has(doc.model.getText(start, start + 1, true))) {
            doc.selectionStart = doc.selectionEnd = start + 1;
        } else
            doc.delete();
    }
}

export function stringQuote(doc: EditableDocument, start: number = doc.selectionStart, end: number = doc.selectionEnd) {
    if (start != end) {
        doc.insertString('"');
    } else {
        let cursor = doc.getTokenCursor(start);
        if (cursor.withinString()) {
            // inside a string, let's be clever
            if (cursor.offsetEnd - 1 == start && cursor.getToken().type == "str" || cursor.getToken().type == "str-end") {
                doc.selectionStart = doc.selectionEnd = start + 1;
            } else {
                doc.model.edit([
                    new ModelEdit('changeRange', [start, start, '"'])
                ], { selection: emptySelectionOption(start + 1) });
            }
        } else {
            doc.model.edit([
                new ModelEdit('changeRange', [start, start, '""'])
            ], { selection: emptySelectionOption(start + 1) });
        }
    }
}

export function growSelection(doc: EditableDocument, start: number = doc.selectionStart, end: number = doc.selectionEnd) {
    const startC = doc.getTokenCursor(start),
        endC = doc.getTokenCursor(end),
        emptySelection = startC.equals(endC);

    if (emptySelection) {
        const currentFormRange = startC.rangeForCurrentForm(start);
        if (currentFormRange) {
            growSelectionStack(doc, currentFormRange);
        } else {
            console.log("no move");
        }
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

function growSelectionStack(doc: EditableDocument, range: [number, number]) {
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

export function shrinkSelection(doc: EditableDocument) {
    if (doc.growSelectionStack.length) {
        let [stackStart, stackEnd] = doc.growSelectionStack.pop();
        if (doc.growSelectionStack.length && stackStart == doc.selectionStart && stackEnd == doc.selectionEnd) {
            [doc.selectionStart, doc.selectionEnd] = doc.growSelectionStack[doc.growSelectionStack.length - 1];
        }
    }
}

export function raiseSexp(doc: EditableDocument, start = doc.selectionStart, end = doc.selectionEnd) {
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
                    doc.model.edit([
                        new ModelEdit('changeRange', [cursor.offsetStart, endCursor.offsetEnd, raised])
                    ], { selection: emptySelectionOption(cursor.offsetStart) });
                }
            }
        }
    }
}

export function convolute(doc: EditableDocument, start = doc.selectionStart, end = doc.selectionEnd) {
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
                            doc.model.edit([
                                new ModelEdit('changeRange', [headEnd.offsetEnd, headEnd.offsetEnd, ")"]),
                                new ModelEdit('changeRange', [cursorEnd.offsetStart, cursorEnd.offsetEnd, ""]),
                                new ModelEdit('changeRange', [cursorStart.offsetStart, end, ""]),
                                new ModelEdit('changeRange', [headStart.offsetStart, headStart.offsetStart, "(" + head])
                            ], {});
                        }
                    }
                }
            }
        }
    }
}

export function transpose(doc: EditableDocument, start = doc.selectionStart, end = doc.selectionEnd) {
    if (start == end) {
        const cursor = doc.getTokenCursor(end);
        cursor.backwardWhitespace();
        if (cursor.getPrevToken().type == 'open') {
            cursor.forwardSexp();
        }
        cursor.forwardWhitespace();
        if (cursor.getToken().type == 'close') {
            cursor.backwardSexp();
        }
        if (cursor.getToken().type != 'close') {
            const rightStart = cursor.offsetStart;
            if (cursor.forwardSexp()) {
                const rightEnd = cursor.offsetStart;
                cursor.backwardSexp();
                cursor.backwardWhitespace();
                const leftEnd = cursor.offsetStart;
                if (cursor.backwardSexp()) {
                    const leftStart = cursor.offsetStart,
                    leftText = doc.model.getText(leftStart, leftEnd),
                    rightText = doc.model.getText(rightStart, rightEnd),
                    newCursorPos = leftStart + rightText.length;
                    doc.model.edit([
                        new ModelEdit('changeRange', [rightStart, rightEnd, leftText]),
                        new ModelEdit('changeRange', [leftStart, leftEnd, rightText, [start, start], [newCursorPos, newCursorPos]])
                    ], { selection: emptySelectionOption(newCursorPos)});
                }
            }
        }
    }
}