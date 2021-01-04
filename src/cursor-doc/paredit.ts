import { validPair } from "./clojure-lexer";
import { ModelEdit, EditableDocument, ModelEditOptions, ModelEditSelection } from "./model";

// NB: doc.model.edit returns a Thenable, so that the vscode Editor can compose commands.
// But don't put such chains in this module because that won't work in the repl-console.
// In the repl-console, compose commands just by performing them in succession, making sure
// you provide selections, old and new.

// TODO: Implement all movement and selection commands here, instead of composing them
//       exactly the same way in the editor and in the repl-window.
//       Example: paredit.moveToRangeRight(this.readline, paredit.forwardSexpRange(this.readline))
//                => paredit.moveForwardSexp(this.readline)

export function killRange(doc: EditableDocument, range: [number, number], start = doc.selectionLeft, end = doc.selectionRight) {
    const [left, right] = [Math.min(...range), Math.max(...range)];
    doc.model.edit([
        new ModelEdit('deleteRange', [left, right - left, [start, end]])
    ], { selection: new ModelEditSelection(left) });
}

export function moveToRangeLeft(doc: EditableDocument, range: [number, number]) {
    doc.selection = new ModelEditSelection(Math.min(range[0], range[1]));
}

export function moveToRangeRight(doc: EditableDocument, range: [number, number]) {
    doc.selection = new ModelEditSelection(Math.max(range[0], range[1]));
}

export function selectRange(doc: EditableDocument, range: [number, number]) {
    growSelectionStack(doc, range)
}

export function selectRangeFromSelectionLeft(doc: EditableDocument, range: [number, number]) {
    const selectionLeft = Math.min(doc.selectionLeft, doc.selectionRight),
        rangeRight = Math.max(range[0], range[1]);
    growSelectionStack(doc, [selectionLeft, rangeRight])
}

export function selectRangeFromSelectionRight(doc: EditableDocument, range: [number, number]) {
    const selectionRight = Math.max(doc.selectionLeft, doc.selectionRight),
        rangeLeft = Math.min(range[0], range[1]);
    growSelectionStack(doc, [selectionRight, rangeLeft])
}


/**
 * Gets the range for the ”current” top level form
 * @see ListTokenCursor.rangeForDefun
 */
export function rangeForDefun(doc: EditableDocument, offset: number = doc.selectionLeft, start: number = 0): [number, number] {
    const cursor = doc.getTokenCursor(start);
    return cursor.rangeForDefun(offset);
}

export function forwardSexpRange(doc: EditableDocument, offset = Math.max(doc.selection.anchor, doc.selection.active)): [number, number] {
    const cursor = doc.getTokenCursor(offset);
    cursor.forwardWhitespace();
    if (cursor.forwardSexp()) {
        return [offset, cursor.offsetStart];
    } else {
        return [offset, offset];
    }
}

export function backwardSexpRange(doc: EditableDocument, offset: number = Math.min(doc.selection.anchor, doc.selection.active)): [number, number] {
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

export function rangeToForwardUpList(doc: EditableDocument, offset: number = Math.max(doc.selection.anchor, doc.selection.active)): [number, number] {
    const cursor = doc.getTokenCursor(offset);
    cursor.forwardList();
    if (cursor.upList()) {
        return [offset, cursor.offsetStart];
    } else {
        return [offset, offset];
    }
}

export function rangeToBackwardUpList(doc: EditableDocument, offset: number = Math.min(doc.selection.anchor, doc.selection.active)): [number, number] {
    const cursor = doc.getTokenCursor(offset);
    cursor.backwardList();
    if (cursor.backwardUpList()) {
        return [cursor.offsetStart, offset];
    } else {
        return [offset, offset];
    }
}

export function rangeToForwardDownList(doc: EditableDocument, offset: number = Math.max(doc.selection.anchor, doc.selection.active)): [number, number] {
    const cursor = doc.getTokenCursor(offset);
    do {
        cursor.forwardThroughAnyReader();
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

export function rangeToBackwardDownList(doc: EditableDocument, offset: number = Math.min(doc.selection.anchor, doc.selection.active)): [number, number] {
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

export function rangeToForwardList(doc: EditableDocument, offset: number = Math.max(doc.selection.anchor, doc.selection.active)): [number, number] {
    const cursor = doc.getTokenCursor(offset);
    if (cursor.forwardList()) {
        return [offset, cursor.offsetStart];
    } else {
        return [offset, offset];
    }
}

export function rangeToBackwardList(doc: EditableDocument, offset: number = Math.min(doc.selection.anchor, doc.selection.active)): [number, number] {
    const cursor = doc.getTokenCursor(offset);
    if (cursor.backwardList()) {
        return [cursor.offsetStart, offset];
    } else {
        return [offset, offset];
    }
}

export function wrapSexpr(doc: EditableDocument, open: string, close: string, start: number = doc.selectionLeft, end: number = doc.selectionRight, options = { skipFormat: false }): Thenable<boolean> {
    const cursor = doc.getTokenCursor(end);
    if (cursor.withinString() && open == '"') {
        open = close = '\\"';
    }
    if (start == end) { // No selection
        const currentFormRange = cursor.rangeForCurrentForm(start);
        if (currentFormRange) {
            const range = currentFormRange;
            return doc.model.edit([
                new ModelEdit('insertString', [range[1], close]),
                new ModelEdit('insertString', [range[0], open, [end, end], [start + open.length, start + open.length]])
            ], {
                selection: new ModelEditSelection(start + open.length),
                skipFormat: options.skipFormat
            });
        }
    } else { // there is a selection
        const range = [Math.min(start, end), Math.max(start, end)];
        return doc.model.edit([
            new ModelEdit('insertString', [range[1], close]),
            new ModelEdit('insertString', [range[0], open])
        ], {
            selection: new ModelEditSelection(start + open.length),
            skipFormat: options.skipFormat
        });
    }
}

export function rewrapSexpr(doc: EditableDocument, open: string, close: string, start: number = doc.selectionLeft, end: number = doc.selectionRight): Thenable<boolean> {
    const cursor = doc.getTokenCursor(end);
    if (cursor.backwardList()) {
        const openStart = cursor.offsetStart - 1,
            openEnd = cursor.offsetStart;
        if (cursor.forwardList()) {
            const closeStart = cursor.offsetStart,
                closeEnd = cursor.offsetEnd;
            return doc.model.edit([
                new ModelEdit('changeRange', [closeStart, closeEnd, close]),
                new ModelEdit('changeRange', [openStart, openEnd, open])
            ], { selection: new ModelEditSelection(end) });
        }
    }
}

export function splitSexp(doc: EditableDocument, start: number = doc.selectionRight) {
    const cursor = doc.getTokenCursor(start);
    if (!cursor.withinString() && !(cursor.isWhiteSpace() || cursor.previousIsWhiteSpace())) {
        cursor.forwardWhitespace();
    }
    const splitPos = cursor.withinString() ? start : cursor.offsetStart;
    if (cursor.backwardList()) {
        const open = cursor.getPrevToken().raw;
        if (cursor.forwardList()) {
            const close = cursor.getToken().raw;
            doc.model.edit([
                new ModelEdit('changeRange', [splitPos, splitPos, `${close}${open}`])
            ], { selection: new ModelEditSelection(splitPos + 1) });
        }
    }
}

/**
 * If `start` is between two strings or two lists of the same type: join them. Otherwise do nothing.
 * @param doc
 * @param start
 */
export function joinSexp(doc: EditableDocument, start: number = doc.selectionRight): Thenable<boolean> {
    let cursor = doc.getTokenCursor(start);
    cursor.backwardWhitespace();
    const prevToken = cursor.getPrevToken(),
        prevEnd = cursor.offsetStart;
    if (['close', 'str-end', 'str'].includes(prevToken.type)) {
        cursor.forwardWhitespace();
        const nextToken = cursor.getToken(),
            nextStart = cursor.offsetStart;
        if (validPair(nextToken.raw[0], prevToken.raw[prevToken.raw.length - 1])) {
            return doc.model.edit([
                new ModelEdit('changeRange', [prevEnd - 1, nextStart + 1, prevToken.type === 'close' ? " " : "", [start, start], [prevEnd, prevEnd]])
            ], { selection: new ModelEditSelection(prevEnd), formatDepth: 2 });
        }
    }
}

export function spliceSexp(doc: EditableDocument, start: number = doc.selectionRight, undoStopBefore = true): Thenable<boolean> {
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
            ], { undoStopBefore, selection: new ModelEditSelection(start - 1) });
        }
    }
}

export function killBackwardList(doc: EditableDocument, start: number = doc.selectionRight): Thenable<boolean> {
    let cursor = doc.getTokenCursor(start);
    cursor.backwardList();
    return doc.model.edit([
        new ModelEdit('changeRange', [cursor.offsetStart, start, "", [start, start], [cursor.offsetStart, cursor.offsetStart]])
    ], { selection: new ModelEditSelection(cursor.offsetStart) });
}

export function killForwardList(doc: EditableDocument, start: number = doc.selectionRight): Thenable<boolean> {
    let cursor = doc.getTokenCursor(start);
    let inComment = (cursor.getToken().type == "comment" && start > cursor.offsetStart) || cursor.getPrevToken().type == "comment";
    cursor.forwardList();
    return doc.model.edit([
        new ModelEdit('changeRange', [start, cursor.offsetStart, inComment ? "\n" : "", [start, start], [start, start]])
    ], { selection: new ModelEditSelection(start) });
}

export function forwardSlurpSexp(doc: EditableDocument, start: number = doc.selectionRight, extraOpts = {}) {
    let cursor = doc.getTokenCursor(start);
    cursor.forwardList();
    if (cursor.getToken().type == "close") {
        let offset = cursor.offsetStart;
        let close = cursor.getToken().raw;
        cursor.next();
        const hasWs = cursor.getToken().type === 'ws';
        cursor.forwardSexp();
        cursor.backwardWhitespace(false);
        if (cursor.offsetStart !== offset + close.length) {
            doc.model.edit([
                new ModelEdit('insertString', [cursor.offsetStart, close]),
                !hasWs ?
                    new ModelEdit('changeRange', [offset, offset + close.length, ' ']) :
                    new ModelEdit('deleteRange', [offset, close.length])
            ], {
                ...{
                    undoStopBefore: true
                },
                ...extraOpts
            });
        } else {
            const formatDepth = extraOpts["formatDepth"] ? extraOpts["formatDepth"] : 1;
            forwardSlurpSexp(doc, cursor.offsetStart, { formatDepth: formatDepth + 1 });
        }
    }
}

export function backwardSlurpSexp(doc: EditableDocument, start: number = doc.selectionRight, extraOpts = {}) {
    let cursor = doc.getTokenCursor(start);
    cursor.backwardList();
    let tk = cursor.getPrevToken();
    if (tk.type == "open") {
        let offset = cursor.clone().previous().offsetStart;
        let open = cursor.getPrevToken().raw;
        cursor.previous();
        cursor.backwardSexp(true);
        cursor.forwardWhitespace(false);
        if (offset !== cursor.offsetStart) {
            doc.model.edit([
                new ModelEdit('deleteRange', [offset, tk.raw.length]),
                new ModelEdit('changeRange', [cursor.offsetStart, cursor.offsetStart, open])
            ], {
                ...{
                    undoStopBefore: true
                },
                ...extraOpts
            });
        } else {
            const formatDepth = extraOpts["formatDepth"] ? extraOpts["formatDepth"] : 1;
            backwardSlurpSexp(doc, cursor.offsetStart, { formatDepth: formatDepth + 1 })
        }
    }
}

export function forwardBarfSexp(doc: EditableDocument, start: number = doc.selectionRight) {
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
        ], start >= cursor.offsetStart ? {
            selection: new ModelEditSelection(cursor.offsetStart),
            formatDepth: 2
        } : { formatDepth: 2 });
    }
}

export function backwardBarfSexp(doc: EditableDocument, start: number = doc.selectionRight) {
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
        ], start <= cursor.offsetStart ? {
            selection: new ModelEditSelection(cursor.offsetStart),
            formatDepth: 2
        } : { formatDepth: 2 });
    }
}

export function open(doc: EditableDocument, open: string, close: string, start: number = doc.selectionRight) {
    let [cs, ce] = [doc.selectionLeft, doc.selectionRight];
    doc.insertString(open + doc.getSelectionText() + close);
    if (cs != ce) {
        doc.selection = new ModelEditSelection(cs + open.length, ce + open.length);
    } else {
        doc.selection = new ModelEditSelection(start + open.length);
    }
}

export function close(doc: EditableDocument, close: string, start: number = doc.selectionRight) {
    const cursor = doc.getTokenCursor(start);
    cursor.forwardWhitespace(false);
    if (cursor.getToken().raw == close) {
        doc.selection = new ModelEditSelection(start + close.length);
    } else {
        doc.model.edit([
            new ModelEdit('changeRange', [start, start, close])
        ], { selection: new ModelEditSelection(start + close.length) });
    }
}

const parenPair = new Set(["()", "[]", "{}", '""', '\\"'])
const openParen = new Set(["(", "[", "{", '"'])
const closeParen = new Set([")", "]", "}", '"'])

export function backspace(doc: EditableDocument, start: number = doc.selectionLeft, end: number = doc.selectionRight) {
    const cursor = doc.getTokenCursor(start);
    if (start != end || cursor.withinString()) {
        doc.backspace();
    } else {
        const p = start;
        if (cursor.getPrevToken().type == 'prompt') {
            return;
        } else if (cursor.getToken().type == 'prompt') {
            return;
        } else if (doc.model.getText(p - 3, p, true) == '\\""') {
            doc.selection = new ModelEditSelection(p - 1);
        } else if (doc.model.getText(p - 2, p - 1, true) == '\\') {
            doc.model.edit([
                new ModelEdit('deleteRange', [p - 2, 2])
            ], { selection: new ModelEditSelection(p - 2) });
        } else if (parenPair.has(doc.model.getText(p - 1, p + 1, true))) {
            doc.model.edit([
                new ModelEdit('deleteRange', [p - 1, 2])
            ], { selection: new ModelEditSelection(p - 1) });
        } else {
            const prevChar = doc.model.getText(p - 1, p);
            if (openParen.has(prevChar) && cursor.forwardList() || closeParen.has(prevChar) && cursor.backwardSexp()) {
                doc.selection = new ModelEditSelection(p - 1);
            } else {
                doc.backspace();
            }
        }
    }
}

export function deleteForward(doc: EditableDocument, start: number = doc.selectionLeft, end: number = doc.selectionRight) {
    const cursor = doc.getTokenCursor(start);
    if (start != end || cursor.withinString()) {
        doc.delete();
    } else {
        const p = start;
        if (parenPair.has(doc.model.getText(p - 1, p + 1, true))) {
            doc.model.edit([
                new ModelEdit('deleteRange', [p - 1, 2])
            ], {});
        } else {
            const nextChar = doc.model.getText(p, p + 1);
            if (openParen.has(nextChar) && cursor.forwardSexp() || closeParen.has(nextChar) && cursor.backwardList()) {
                doc.selection = new ModelEditSelection(p + 1);
            } else {
                doc.delete();
            }
        }
    }
}

export function stringQuote(doc: EditableDocument, start: number = doc.selectionLeft, end: number = doc.selectionRight) {
    if (start != end) {
        doc.insertString('"');
    } else {
        let cursor = doc.getTokenCursor(start);
        if (cursor.withinString()) {
            // inside a string, let's be clever
            if (cursor.getToken().type == "close") {
                if (doc.model.getText(0, start).endsWith('\\')) {
                    doc.model.edit([
                        new ModelEdit('changeRange', [start, start, '"'])
                    ], { selection: new ModelEditSelection(start + 1) });
                } else {
                    close(doc, '"', start);
                }
            } else {
                if (doc.model.getText(0, start).endsWith('\\')) {
                    doc.model.edit([
                        new ModelEdit('changeRange', [start, start, '"'])
                    ], { selection: new ModelEditSelection(start + 1) });
                } else {
                    doc.model.edit([
                        new ModelEdit('changeRange', [start, start, '\\"'])
                    ], { selection: new ModelEditSelection(start + 2) });
                }
            }
        } else {
            doc.model.edit([
                new ModelEdit('changeRange', [start, start, '""'])
            ], { selection: new ModelEditSelection(start + 1) });
        }
    }
}

export function growSelection(doc: EditableDocument, start: number = doc.selectionLeft, end: number = doc.selectionRight) {
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

export function growSelectionStack(doc: EditableDocument, range: [number, number]) {
    const [start, end] = range;
    if (doc.selectionStack.length > 0) {
        let prev = doc.selectionStack[doc.selectionStack.length - 1];
        if (!(doc.selectionLeft == prev.anchor && doc.selectionRight == prev.active)) {
            setSelectionStack(doc);
        } else if (prev.anchor === range[0] && prev.active === range[1]) {
            return;
        }
    } else {
        doc.selectionStack = [doc.selection];
    }
    doc.selection = new ModelEditSelection(start, end);
    doc.selectionStack.push(doc.selection);
}

export function shrinkSelection(doc: EditableDocument) {
    if (doc.selectionStack.length) {
        let latest = doc.selectionStack.pop();
        if (doc.selectionStack.length && latest.anchor == doc.selectionLeft && latest.active == doc.selectionRight) {
            doc.selection = doc.selectionStack[doc.selectionStack.length - 1];
        }
    }
}

export function setSelectionStack(doc: EditableDocument, selection = doc.selection) {
    doc.selectionStack = [selection];
}

export function raiseSexp(doc: EditableDocument, start = doc.selectionLeft, end = doc.selectionRight) {
    if (start == end) {
        let cursor = doc.getTokenCursor(end);
        cursor.forwardWhitespace();
        cursor.backwardThroughAnyReader();
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
                    ], { selection: new ModelEditSelection(cursor.offsetStart) });
                }
            }
        }
    }
}

export function convolute(doc: EditableDocument, start = doc.selectionLeft, end = doc.selectionRight) {
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

export function transpose(doc: EditableDocument, left = doc.selectionLeft, right = doc.selectionRight, newPosOffset: { fromLeft?: number, fromRight?: number } = {}) {
    const cursor = doc.getTokenCursor(right);
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
                    rightText = doc.model.getText(rightStart, rightEnd);
                let newCursorPos = leftStart + rightText.length;
                if (newPosOffset.fromLeft != undefined) {
                    newCursorPos = leftStart + newPosOffset.fromLeft
                } else if (newPosOffset.fromRight != undefined) {
                    newCursorPos = rightEnd - newPosOffset.fromRight
                }
                doc.model.edit([
                    new ModelEdit('changeRange', [rightStart, rightEnd, leftText]),
                    new ModelEdit('changeRange', [leftStart, leftEnd, rightText, [left, left], [newCursorPos, newCursorPos]])
                ], { selection: new ModelEditSelection(newCursorPos) });
            }
        }
    }
}

export function dragSexprBackward(doc: EditableDocument, left = doc.selectionLeft, right = doc.selectionRight) {
    const cursor = doc.getTokenCursor(right),
        currentRange = cursor.rangeForCurrentForm(right),
        newPosOffset = right - currentRange[0];
    const backCursor = doc.getTokenCursor(currentRange[0]);
    backCursor.backwardWhitespace();
    backCursor.backwardSexp();
    const backRange = backCursor.rangeForCurrentForm(backCursor.offsetEnd);
    if (backRange[0] !== currentRange[0]) { // there is a sexp to the left
        transpose(doc, left, currentRange[0], { fromLeft: newPosOffset });
    }
}

export function dragSexprForward(doc: EditableDocument, left = doc.selectionLeft, right = doc.selectionRight) {
    const cursor = doc.getTokenCursor(right),
        currentRange = cursor.rangeForCurrentForm(right),
        newPosOffset = currentRange[1] - right;
    const forwardCursor = doc.getTokenCursor(currentRange[1]);
    forwardCursor.forwardWhitespace();
    forwardCursor.forwardSexp();
    const forwardRange = forwardCursor.rangeForCurrentForm(forwardCursor.offsetEnd);
    if (forwardRange[0] !== currentRange[0]) { // there is a sexp to the right
        transpose(doc, left, currentRange[1], { fromRight: newPosOffset });
    }
}

export type WhitespaceInfo = {
    hasLeftWs: boolean,
    leftWsRange: [number, number]
    leftWs: string,
    leftWsHasNewline: boolean,
    hasRightWs: boolean,
    rightWsRange: [number, number]
    rightWs: string,
    rightWsHasNewline: boolean,
}

/**
 * Collect and return information about the current form regarding its surrounding whitespace
 * @param doc
 * @param p the position in `doc` from where to determine the current form
 */
export function collectWhitespaceInfo(doc: EditableDocument, p = doc.selectionRight): WhitespaceInfo {
    const cursor = doc.getTokenCursor(p),
        currentRange = cursor.rangeForCurrentForm(p),
        leftWsRight = currentRange[0],
        leftWsCursor = doc.getTokenCursor(leftWsRight),
        rightWsLeft = currentRange[1],
        rightWsCursor = doc.getTokenCursor(rightWsLeft);
    leftWsCursor.backwardWhitespace();
    rightWsCursor.forwardWhitespace();
    const leftWsLeft = leftWsCursor.offsetStart,
        leftWs = doc.model.getText(leftWsLeft, leftWsRight),
        leftWsHasNewline = leftWs.indexOf('\n') !== -1,
        rightWsRight = rightWsCursor.offsetStart,
        rightWs = doc.model.getText(rightWsLeft, rightWsRight),
        rightWsHasNewline = rightWs.indexOf('\n') !== -1;;
    return {
        hasLeftWs: leftWs !== '',
        leftWsRange: [leftWsLeft, leftWsRight],
        leftWs,
        leftWsHasNewline,
        hasRightWs: rightWs !== '',
        rightWsRange: [rightWsLeft, rightWsRight],
        rightWs,
        rightWsHasNewline
    }
}

export function dragSexprBackwardUp(doc: EditableDocument, p = doc.selectionRight) {
    const wsInfo = collectWhitespaceInfo(doc, p),
        cursor = doc.getTokenCursor(p),
        currentRange = cursor.rangeForCurrentForm(p);
    if (cursor.backwardList() && cursor.backwardUpList()) {
        const listStart = cursor.offsetStart,
            newPosOffset = p - currentRange[0],
            newCursorPos = listStart + newPosOffset,
            listIndent = cursor.getToken().offset;
        let dragText: string,
            deleteEdit: ModelEdit;
        if (wsInfo.hasLeftWs) {
            dragText = doc.model.getText(...currentRange) + (wsInfo.leftWsHasNewline ? '\n' + ' '.repeat(listIndent) : ' ');
            deleteEdit = new ModelEdit('deleteRange', [wsInfo.leftWsRange[0], currentRange[1] - wsInfo.leftWsRange[0]]);
        } else {
            dragText = doc.model.getText(...currentRange) + (wsInfo.rightWsHasNewline ? '\n' + ' '.repeat(listIndent) : ' ');
            deleteEdit = new ModelEdit('deleteRange', [currentRange[0], wsInfo.rightWsRange[1] - currentRange[0]]);
        }
        doc.model.edit([
            deleteEdit,
            new ModelEdit('insertString', [listStart, dragText, [p, p], [newCursorPos, newCursorPos]])
        ], {
            selection: new ModelEditSelection(newCursorPos),
            skipFormat: false,
            undoStopBefore: true
        });
    }
}

export function dragSexprForwardDown(doc: EditableDocument, p = doc.selectionRight) {
    const wsInfo = collectWhitespaceInfo(doc, p),
        currentRange = doc.getTokenCursor(p).rangeForCurrentForm(p),
        newPosOffset = p - currentRange[0],
        cursor = doc.getTokenCursor(currentRange[0]);
    while (cursor.forwardSexp()) {
        cursor.forwardWhitespace();
        const token = cursor.getToken();
        if (token.type === 'open') {
            const listStart = cursor.offsetStart,
                deleteLength = wsInfo.rightWsRange[1] - currentRange[0],
                insertStart = listStart + token.raw.length,
                newCursorPos = insertStart - deleteLength + newPosOffset;
            let insertText = doc.model.getText(...currentRange);
            insertText += wsInfo.rightWsHasNewline ? '\n' : ' ';
            doc.model.edit([
                new ModelEdit('insertString', [insertStart, insertText, [p, p], [newCursorPos, newCursorPos]]),
                new ModelEdit('deleteRange', [currentRange[0], deleteLength])
            ], {
                selection: new ModelEditSelection(newCursorPos),
                skipFormat: false,
                undoStopBefore: true
            });
            break;
        }
    }
}

export function dragSexprForwardUp(doc: EditableDocument, p = doc.selectionRight) {
    const wsInfo = collectWhitespaceInfo(doc, p),
        cursor = doc.getTokenCursor(p),
        currentRange = cursor.rangeForCurrentForm(p);
    if (cursor.forwardList() && cursor.upList()) {
        const listEnd = cursor.offsetStart,
            newPosOffset = p - currentRange[0],
            listWsInfo = collectWhitespaceInfo(doc, listEnd),
            dragText = (listWsInfo.rightWsHasNewline ? '\n' : ' ') + doc.model.getText(...currentRange);
        let deleteStart = wsInfo.leftWsRange[0],
            deleteLength = currentRange[1] - deleteStart;
        if (wsInfo.hasRightWs) {
            deleteStart = currentRange[0];
            deleteLength = wsInfo.rightWsRange[1] - deleteStart;
        }
        const newCursorPos = listEnd + newPosOffset + 1 - deleteLength;
        doc.model.edit([
            new ModelEdit('insertString', [listEnd, dragText, [p, p], [newCursorPos, newCursorPos]]),
            new ModelEdit('deleteRange', [deleteStart, deleteLength])
        ], {
            selection: new ModelEditSelection(newCursorPos),
            skipFormat: false,
            undoStopBefore: true
        });
    }
}

export function dragSexprBackwardDown(doc: EditableDocument, p = doc.selectionRight) {
    const wsInfo = collectWhitespaceInfo(doc, p),
        currentRange = doc.getTokenCursor(p).rangeForCurrentForm(p),
        newPosOffset = p - currentRange[0],
        cursor = doc.getTokenCursor(currentRange[1]);
    while (cursor.backwardSexp()) {
        cursor.backwardWhitespace();
        const token = cursor.getPrevToken();
        if (token.type === 'close') {
            cursor.previous();
            const listEnd = cursor.offsetStart;
            cursor.backwardWhitespace();
            const siblingWsInfo = collectWhitespaceInfo(doc, cursor.offsetStart),
                deleteLength = currentRange[1] - wsInfo.leftWsRange[0],
                insertStart = listEnd,
                newCursorPos = insertStart + newPosOffset + 1;
            let insertText = doc.model.getText(...currentRange);
            insertText = (siblingWsInfo.leftWsHasNewline ? '\n' : ' ') + insertText;
            doc.model.edit([
                new ModelEdit('deleteRange', [wsInfo.leftWsRange[0], deleteLength]),
                new ModelEdit('insertString', [insertStart, insertText, [p, p], [newCursorPos, newCursorPos]])
            ], {
                selection: new ModelEditSelection(newCursorPos),
                skipFormat: false,
                undoStopBefore: true
            });
            break;
        }
    }
}