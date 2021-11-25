import { includes } from "lodash";
import { validPair } from "./clojure-lexer";
import { ModelEdit, EditableDocument, ModelEditSelection } from "./model";
import { LispTokenCursor } from "./token-cursor";

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

export function selectRangeForward(doc: EditableDocument, range: [number, number]) {
    const selectionLeft = doc.selection.anchor;
    const rangeRight = Math.max(range[0], range[1]);
    growSelectionStack(doc, [selectionLeft, rangeRight])
}

export function selectRangeBackward(doc: EditableDocument, range: [number, number]) {
    const selectionRight = doc.selection.anchor;
    const rangeLeft = Math.min(range[0], range[1]);
    growSelectionStack(doc, [selectionRight, rangeLeft])
}

export function selectForwardSexp(doc: EditableDocument) {
    const rangeFn = doc.selection.active >= doc.selection.anchor ?
        forwardSexpRange : (doc: EditableDocument) => forwardSexpRange(doc, doc.selection.active, true);
    selectRangeForward(doc, rangeFn(doc));
}

export function selectRight(doc: EditableDocument) {
    const rangeFn = doc.selection.active >= doc.selection.anchor ?
        forwardHybridSexpRange : (doc: EditableDocument) => forwardHybridSexpRange(doc, doc.selection.active, true);
    selectRangeForward(doc, rangeFn(doc));
}

export function selectBackwardSexp(doc: EditableDocument) {
    const rangeFn = doc.selection.active <= doc.selection.anchor ?
        backwardSexpRange : (doc: EditableDocument) => backwardSexpRange(doc, doc.selection.active, false);
    selectRangeBackward(doc, rangeFn(doc));
}

export function selectForwardDownSexp(doc: EditableDocument) {
    const rangeFn = doc.selection.active >= doc.selection.anchor ?
        (doc: EditableDocument) => rangeToForwardDownList(doc, doc.selection.active, true) :
        (doc: EditableDocument) => rangeToForwardDownList(doc, doc.selection.active, true);
    selectRangeForward(doc, rangeFn(doc));
}

export function selectBackwardDownSexp(doc: EditableDocument) {
    selectRangeBackward(doc, rangeToBackwardDownList(doc));
}

export function selectForwardUpSexp(doc: EditableDocument) {
    selectRangeForward(doc, rangeToForwardUpList(doc, doc.selectionRight));
}

export function selectBackwardUpSexp(doc: EditableDocument) {
    const rangeFn = doc.selection.active <= doc.selection.anchor ?
        (doc: EditableDocument) => rangeToBackwardUpList(doc, doc.selection.active, false) :
        (doc: EditableDocument) => rangeToBackwardUpList(doc, doc.selection.active, false);
    selectRangeBackward(doc, rangeFn(doc));
}

export function selectCloseList(doc: EditableDocument) {
    selectRangeForward(doc, rangeToForwardList(doc, doc.selectionRight));
}

export function selectOpenList(doc: EditableDocument) {
    selectRangeBackward(doc, rangeToBackwardList(doc));
}


/**
 * Gets the range for the ”current” top level form
 * @see ListTokenCursor.rangeForDefun
 */
export function rangeForDefun(doc: EditableDocument, offset: number = doc.selection.active, commentCreatesTopLevel = true): [number, number] {
    const cursor = doc.getTokenCursor(offset);
    return cursor.rangeForDefun(offset, commentCreatesTopLevel);
}

export function forwardSexpRange(doc: EditableDocument, offset = Math.max(doc.selection.anchor, doc.selection.active), goPastWhitespace = false): [number, number] {
    const cursor = doc.getTokenCursor(offset);
    cursor.forwardWhitespace();
    if (cursor.forwardSexp()) {
        if (goPastWhitespace) {
            cursor.forwardWhitespace();
        }
        return [offset, cursor.offsetStart];
    } else {
        return [offset, offset];
    }
}

export function backwardSexpRange(doc: EditableDocument, offset: number = Math.min(doc.selection.anchor, doc.selection.active), goPastWhitespace = false): [number, number] {
    const cursor = doc.getTokenCursor(offset);
    if (!cursor.isWhiteSpace() && cursor.offsetStart < offset) {
        // This is because cursor.backwardSexp() can't move backwards when "on" the first sexp inside a list
        // TODO: Try to fix this in LispTokenCursor instead.
        cursor.forwardSexp();
    }
    cursor.backwardWhitespace();
    if (cursor.backwardSexp()) {
        if (goPastWhitespace) {
            cursor.backwardWhitespace();
        }
        return [cursor.offsetStart, offset];
    } else {
        return [offset, offset];
    }
}

export function forwardListRange(doc: EditableDocument, start: number = doc.selectionRight): [number, number] {
    const cursor = doc.getTokenCursor(start);
    cursor.forwardList();
    return [start, cursor.offsetStart];
}

export function backwardListRange(doc: EditableDocument, start: number = doc.selectionRight): [number, number] {
    const cursor = doc.getTokenCursor(start);
    cursor.backwardList();
    return [cursor.offsetStart, start];
}


/**
 * Aims to find the end of the current form (list|vector|map|set|string etc)
 * When there is a newline before the end of the current form either:
 *  - Return the end of the nearest form to the right of the cursor location if one exists
 *  - Returns the newline's offset if no form exists
 *
 * This function's output range is needed to implement features similar to paredit's
 * killRight or smartparens' sp-kill-hybrid-sexp.
 *
 * @param doc
 * @param offset
 * @param goPastWhitespace
 * @returns [number, number]
 */
export function forwardHybridSexpRange(doc: EditableDocument, offset = Math.max(doc.selection.anchor, doc.selection.active), goPastWhitespace = false): [number, number] {
    let cursor = doc.getTokenCursor(offset);
    if (cursor.getToken().type === 'open') {
        return forwardSexpRange(doc);
    } else if (cursor.getToken().type === 'close') {
        return [offset, offset];
    }

    const currentLineText = doc.model.getLineText(cursor.line);
    const lineStart = doc.model.getOffsetForLine(cursor.line);
    const currentLineNewlineOffset = lineStart + currentLineText.length;
    const remainderLineText = doc.model.getText(offset, currentLineNewlineOffset + 1);

    cursor.forwardList(); // move to the end of the current form
    const currentFormEndToken = cursor.getToken();
    // when we've advanced the cursor but start is behind us then go to the end
    // happens when in a clojure comment i.e:  ;; ----
    let cursorOffsetEnd = cursor.offsetStart <= offset ? cursor.offsetEnd : cursor.offsetStart;
    const text = doc.model.getText(offset, cursorOffsetEnd);
    let hasNewline = text.indexOf("\n") > -1;
    let end = cursorOffsetEnd;

    // Want the min of closing token or newline
    // After moving forward, the cursor is not yet at the end of the current line,
    // and it is not a close token. So we include the newline
    // because what forms are here extend beyond the end of the current line
    if (currentLineNewlineOffset > cursor.offsetEnd && currentFormEndToken.type != 'close') {
        hasNewline = true;
        end = currentLineNewlineOffset;
    }

    if (remainderLineText === '' || remainderLineText === '\n') {
        end = currentLineNewlineOffset + doc.model.lineEndingLength;
    } else if (hasNewline) {
        // Try to find the first open token to the right of the document's cursor location if any
        let nearestOpenTokenOffset = -1;

        // Start at the newline.
        // Work backwards to find the smallest open token offset
        // greater than the document's cursor location if any
        cursor = doc.getTokenCursor(currentLineNewlineOffset);
        while (cursor.offsetStart > offset) {
            while (cursor.backwardSexp()) { }
            if (cursor.offsetStart > offset) {
                nearestOpenTokenOffset = cursor.offsetStart;
                cursor = doc.getTokenCursor(cursor.offsetStart - 1);
            }
        }

        if (nearestOpenTokenOffset > 0) {
            cursor = doc.getTokenCursor(nearestOpenTokenOffset);
            cursor.forwardList();
            end = cursor.offsetEnd; // include the closing token
        } else {
            // no open tokens found so the end is the newline
            end = currentLineNewlineOffset;
        }
    }
    return [offset, end];
}



export function rangeToForwardUpList(doc: EditableDocument, offset: number = Math.max(doc.selection.anchor, doc.selection.active), goPastWhitespace = false): [number, number] {
    const cursor = doc.getTokenCursor(offset);
    cursor.forwardList();
    if (cursor.upList()) {
        if (goPastWhitespace) {
            cursor.forwardWhitespace();
        }
        return [offset, cursor.offsetStart];
    } else {
        return [offset, offset];
    }
}

export function rangeToBackwardUpList(doc: EditableDocument, offset: number = Math.min(doc.selection.anchor, doc.selection.active), goPastWhitespace = false): [number, number] {
    const cursor = doc.getTokenCursor(offset);
    cursor.backwardList();
    if (cursor.backwardUpList()) {
        if (goPastWhitespace) {
            cursor.backwardWhitespace();
        }
        return [cursor.offsetStart, offset];
    } else {
        return [offset, offset];
    }
}

export function rangeToForwardDownList(doc: EditableDocument, offset: number = Math.max(doc.selection.anchor, doc.selection.active), goPastWhitespace = false): [number, number] {
    const cursor = doc.getTokenCursor(offset);
    do {
        cursor.forwardThroughAnyReader();
        cursor.forwardWhitespace();
        if (cursor.getToken().type === 'open') {
            break;
        }
    } while (cursor.forwardSexp());
    if (cursor.downList()) {
        if (goPastWhitespace) {
            cursor.forwardWhitespace();
        }
        return [offset, cursor.offsetStart];
    } else {
        return [offset, offset];
    }
}

export function rangeToBackwardDownList(doc: EditableDocument, offset: number = Math.min(doc.selection.anchor, doc.selection.active), goPastWhitespace = false): [number, number] {
    const cursor = doc.getTokenCursor(offset);
    do {
        cursor.backwardWhitespace();
        if (cursor.getPrevToken().type === 'close') {
            break;
        }
    } while (cursor.backwardSexp());
    if (cursor.backwardDownList()) {
        if (goPastWhitespace) {
            cursor.backwardWhitespace();
        }
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
                new ModelEdit('changeRange', [end, end + close.raw.length, ""]),
                new ModelEdit('changeRange', [beginning - open.raw.length, beginning, ""])
            ], { undoStopBefore, selection: new ModelEditSelection(start - 1) });
        }
    }
}

export function killBackwardList(doc: EditableDocument, [start, end]: [number, number]): Thenable<boolean> {
    return doc.model.edit([
        new ModelEdit('changeRange', [start, end, "", [end, end], [start, start]])
    ], { selection: new ModelEditSelection(start) });
}

export function killForwardList(doc: EditableDocument, [start, end]: [number, number]): Thenable<boolean> {
    let cursor = doc.getTokenCursor(start);
    let inComment = (cursor.getToken().type == "comment" && start > cursor.offsetStart) || cursor.getPrevToken().type == "comment";
    return doc.model.edit([
        new ModelEdit('changeRange', [start, end, inComment ? "\n" : "", [start, start], [start, start]])
    ], { selection: new ModelEditSelection(start) });
}

export function forwardSlurpSexp(doc: EditableDocument, start: number = doc.selectionRight, extraOpts = { "formatDepth": 1 }) {
    const cursor = doc.getTokenCursor(start);
    cursor.forwardList();
    if (cursor.getToken().type == "close") {
        const currentCloseOffset = cursor.offsetStart;
        const close = cursor.getToken().raw;
        const wsInsideCursor = cursor.clone();
        wsInsideCursor.backwardWhitespace(false);
        const wsStartOffset = wsInsideCursor.offsetStart;
        cursor.upList();
        const wsOutSideCursor = cursor.clone();
        if (cursor.forwardSexp()) {
            wsOutSideCursor.forwardWhitespace(false);
            const wsEndOffset = wsOutSideCursor.offsetStart;
            const newCloseOffset = cursor.offsetStart;
            const replacedText = doc.model.getText(wsStartOffset, wsEndOffset);
            const changeArgs = replacedText.indexOf('\n') >= 0 ?
                [currentCloseOffset, currentCloseOffset + close.length, ''] :
                [wsStartOffset, wsEndOffset, ' '];
            doc.model.edit([
                new ModelEdit('insertString', [newCloseOffset, close]),
                new ModelEdit('changeRange', changeArgs)
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

function docIsBalanced(doc: EditableDocument, start: number = doc.selection.active): boolean {
    const cursor = doc.getTokenCursor(0);
    while (cursor.forwardSexp(true, true, true));
    cursor.forwardWhitespace(true);
    return cursor.atEnd();
}

export function close(doc: EditableDocument, close: string, start: number = doc.selectionRight) {
    const cursor = doc.getTokenCursor(start);
    const inString = cursor.withinString();
    cursor.forwardWhitespace(false);
    if (cursor.getToken().raw === close) {
        doc.selection = new ModelEditSelection(cursor.offsetEnd);
    } else {
        if (!inString && docIsBalanced(doc)) {
            // Do nothing when there is balance
        } else {
            doc.model.edit([
                new ModelEdit('insertString', [start, close])
            ], { selection: new ModelEditSelection(start + close.length) });
        }
    }
}

export function backspace(doc: EditableDocument, start: number = doc.selection.anchor, end: number = doc.selection.active): Thenable<boolean> {
    const cursor = doc.getTokenCursor(start);
    if (start != end) {
        return doc.backspace();
    } else {
        const nextToken = cursor.getToken();
        const p = start;
        const prevToken = p > cursor.offsetStart && !['open', 'close'].includes(nextToken.type) ? nextToken : cursor.getPrevToken();
        if (prevToken.type == 'prompt') {
            return new Promise<boolean>(resolve => resolve(true));
        } else if (nextToken.type == 'prompt') {
            return new Promise<boolean>(resolve => resolve(true));
        } else if (doc.model.getText(p - 2, p, true) == '\\"') {
            return doc.model.edit([
                new ModelEdit('deleteRange', [p - 2, 2])
            ], { selection: new ModelEditSelection(p - 2) });
        } else if (prevToken.type === 'open' && nextToken.type === 'close') {
            return doc.model.edit([
                new ModelEdit('deleteRange', [p - prevToken.raw.length, prevToken.raw.length + 1])
            ], { selection: new ModelEditSelection(p - prevToken.raw.length) });
        } else {
            if (['open', 'close'].includes(prevToken.type) && docIsBalanced(doc)) {
                doc.selection = new ModelEditSelection(p - prevToken.raw.length);
                return new Promise<boolean>(resolve => resolve(true));
            } else {
                return doc.backspace();
            }
        }
    }
}

export function deleteForward(doc: EditableDocument, start: number = doc.selectionLeft, end: number = doc.selectionRight) {
    const cursor = doc.getTokenCursor(start);
    if (start != end) {
        doc.delete();
    } else {
        const prevToken = cursor.getPrevToken();
        const nextToken = cursor.getToken();
        const p = start;
        if (doc.model.getText(p, p + 2, true) == '\\"') {
            return doc.model.edit([
                new ModelEdit('deleteRange', [p, 2])
            ], { selection: new ModelEditSelection(p) });
        } else if (prevToken.type === 'open' && nextToken.type === 'close') {
            doc.model.edit([
                new ModelEdit('deleteRange', [p - prevToken.raw.length, prevToken.raw.length + 1])
            ], { selection: new ModelEditSelection(p - prevToken.raw.length) });
        } else {
            if (['open', 'close'].includes(nextToken.type) && docIsBalanced(doc)) {
                doc.selection = new ModelEditSelection(p + 1);
                return new Promise<boolean>(resolve => resolve(true));
            } else {
                return doc.delete();
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
    const cursor = doc.getTokenCursor(end);
    const [formStart, formEnd] = cursor.rangeForCurrentForm(start);
    const isCaretTrailing = formEnd - start < start - formStart;
    const startCursor = doc.getTokenCursor(formStart);
    let endCursor = startCursor.clone();
    if (endCursor.forwardSexp()) {
        let raised = doc.model.getText(startCursor.offsetStart, endCursor.offsetStart);
        startCursor.backwardList();
        endCursor.forwardList();
        if (startCursor.getPrevToken().type == "open") {
            startCursor.previous();
            if (endCursor.getToken().type == "close") {
                doc.model.edit([
                    new ModelEdit('changeRange', [startCursor.offsetStart, endCursor.offsetEnd, raised])
                ], {
                    selection: new ModelEditSelection(isCaretTrailing ?
                        startCursor.offsetStart + raised.length :
                        startCursor.offsetStart)
                });
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

export const bindingForms = [
    'let',
    'for',
    'loop',
    'binding',
    'with-local-vars',
    'doseq',
    'with-redefs'
];

function isInPairsList(cursor: LispTokenCursor, pairForms: string[]): boolean {
    const probeCursor = cursor.clone();
    if (probeCursor.backwardList()) {
        const opening = probeCursor.getPrevToken().raw
        if (opening.endsWith('{') && !opening.endsWith('#{')) {
            return true;
        }
        if (opening.endsWith('[')) {
            probeCursor.backwardUpList();
            const fn = probeCursor.getFunctionName();
            if (fn && pairForms.includes(fn)) {
                return true;
            }
        }
        return false;
    }
    return false;
}

/**
 * Returns the range of the current form
 * or the current form pair, if usePairs is true
 */
function currentSexpsRange(doc: EditableDocument, cursor: LispTokenCursor, offset: number, usePairs = false): [number, number] {
    const currentSingleRange = cursor.rangeForCurrentForm(offset);
    if (usePairs) {
        const ranges = cursor.rangesForSexpsInList();
        if (ranges.length > 1) {
            const indexOfCurrentSingle = ranges.findIndex(r => r[0] === currentSingleRange[0] && r[1] === currentSingleRange[1]);
            if (indexOfCurrentSingle % 2 == 0) {
                const pairCursor = doc.getTokenCursor(currentSingleRange[1]);
                pairCursor.forwardSexp();
                return [currentSingleRange[0], pairCursor.offsetStart];
            } else {
                const pairCursor = doc.getTokenCursor(currentSingleRange[0]);
                pairCursor.backwardSexp();
                return [pairCursor.offsetStart, currentSingleRange[1]];
            }
        }
    }
    return currentSingleRange;
}

export function dragSexprBackward(doc: EditableDocument, pairForms = bindingForms, left = doc.selectionLeft, right = doc.selectionRight) {
    const cursor = doc.getTokenCursor(right);
    const usePairs = isInPairsList(cursor, pairForms);
    const currentRange = currentSexpsRange(doc, cursor, right, usePairs);
    const newPosOffset = right - currentRange[0];
    const backCursor = doc.getTokenCursor(currentRange[0]);
    backCursor.backwardSexp();
    const backRange = currentSexpsRange(doc, backCursor, backCursor.offsetStart, usePairs);
    if (backRange[0] !== currentRange[0]) { // there is a sexp to the left
        const leftText = doc.model.getText(backRange[0], backRange[1]);
        const currentText = doc.model.getText(currentRange[0], currentRange[1]);
        doc.model.edit([
            new ModelEdit('changeRange', [currentRange[0], currentRange[1], leftText]),
            new ModelEdit('changeRange', [backRange[0], backRange[1], currentText])
        ], { selection: new ModelEditSelection(backRange[0] + newPosOffset) });
    }
}

export function dragSexprForward(doc: EditableDocument, pairForms = bindingForms, left = doc.selectionLeft, right = doc.selectionRight) {
    const cursor = doc.getTokenCursor(right);
    const usePairs = isInPairsList(cursor, pairForms);
    const currentRange = currentSexpsRange(doc, cursor, right, usePairs);
    const newPosOffset = currentRange[1] - right;
    const forwardCursor = doc.getTokenCursor(currentRange[1]);
    forwardCursor.forwardSexp();
    const forwardRange = currentSexpsRange(doc, forwardCursor, forwardCursor.offsetStart, usePairs);
    if (forwardRange[0] !== currentRange[0]) { // there is a sexp to the right
        const rightText = doc.model.getText(forwardRange[0], forwardRange[1]);
        const currentText = doc.model.getText(currentRange[0], currentRange[1]);
        doc.model.edit([
            new ModelEdit('changeRange', [forwardRange[0], forwardRange[1], currentText]),
            new ModelEdit('changeRange', [currentRange[0], currentRange[1], rightText])
        ], { selection: new ModelEditSelection(currentRange[1] + (forwardRange[1] - currentRange[1]) - newPosOffset) });
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
    const cursor = doc.getTokenCursor(p);
    const currentRange = cursor.rangeForCurrentForm(p);
    const leftWsRight = currentRange[0];
    const leftWsCursor = doc.getTokenCursor(leftWsRight);
    const rightWsLeft = currentRange[1];
    const rightWsCursor = doc.getTokenCursor(rightWsLeft);
    leftWsCursor.backwardWhitespace(false);
    rightWsCursor.forwardWhitespace(false);
    const leftWsLeft = leftWsCursor.offsetStart;
    const leftWs = doc.model.getText(leftWsLeft, leftWsRight);
    const leftWsHasNewline = leftWs.indexOf('\n') !== -1;
    const rightWsRight = rightWsCursor.offsetStart;
    const rightWs = doc.model.getText(rightWsLeft, rightWsRight);
    const rightWsHasNewline = rightWs.indexOf('\n') !== -1;
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
    const wsInfo = collectWhitespaceInfo(doc, p);
    const cursor = doc.getTokenCursor(p);
    const currentRange = cursor.rangeForCurrentForm(p);
    if (cursor.backwardList() && cursor.backwardUpList()) {
        const listStart = cursor.offsetStart;
        const newPosOffset = p - currentRange[0];
        const newCursorPos = listStart + newPosOffset;
        const listIndent = cursor.getToken().offset;
        let dragText: string,
            deleteEdit: ModelEdit;
        if (wsInfo.hasLeftWs) {
            dragText = doc.model.getText(...currentRange) + (wsInfo.leftWsHasNewline ? '\n' + ' '.repeat(listIndent) : ' ');
            const lineCommentCursor = doc.getTokenCursor(wsInfo.leftWsRange[0]);
            const havePrecedingLineComment = lineCommentCursor.getPrevToken().type === 'comment';
            const wsLeftStart = wsInfo.leftWsRange[0] + (havePrecedingLineComment ? 1 : 0);
            deleteEdit = new ModelEdit('deleteRange', [wsLeftStart, currentRange[1] - wsLeftStart]);
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
    const wsInfo = collectWhitespaceInfo(doc, p)
    const currentRange = doc.getTokenCursor(p).rangeForCurrentForm(p);
    const newPosOffset = p - currentRange[0];
    const cursor = doc.getTokenCursor(currentRange[0]);
    while (cursor.forwardSexp()) {
        cursor.forwardWhitespace();
        const token = cursor.getToken();
        if (token.type === 'open') {
            const listStart = cursor.offsetStart;
            const deleteLength = wsInfo.rightWsRange[1] - currentRange[0];
            const insertStart = listStart + token.raw.length;
            const newCursorPos = insertStart - deleteLength + newPosOffset;
            const insertText = doc.model.getText(...currentRange) + (wsInfo.rightWsHasNewline ? '\n' : ' ');
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
    const wsInfo = collectWhitespaceInfo(doc, p);
    const cursor = doc.getTokenCursor(p);
    const currentRange = cursor.rangeForCurrentForm(p);
    if (cursor.forwardList() && cursor.upList()) {
        const listEnd = cursor.offsetStart;
        const newPosOffset = p - currentRange[0];
        const listWsInfo = collectWhitespaceInfo(doc, listEnd);
        const dragText = (listWsInfo.rightWsHasNewline ? '\n' : ' ') + doc.model.getText(...currentRange);
        let deleteStart = wsInfo.leftWsRange[0];
        let deleteLength = currentRange[1] - deleteStart;
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
    const wsInfo = collectWhitespaceInfo(doc, p);
    const currentRange = doc.getTokenCursor(p).rangeForCurrentForm(p);
    const newPosOffset = p - currentRange[0];
    const cursor = doc.getTokenCursor(currentRange[1]);
    while (cursor.backwardSexp()) {
        cursor.backwardWhitespace();
        const token = cursor.getPrevToken();
        if (token.type === 'close') {
            cursor.previous();
            const listEnd = cursor.offsetStart;
            cursor.backwardWhitespace();
            const siblingWsInfo = collectWhitespaceInfo(doc, cursor.offsetStart);
            const deleteLength = currentRange[1] - wsInfo.leftWsRange[0];
            const insertStart = listEnd;
            const newCursorPos = insertStart + newPosOffset + 1;
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

function adaptContentsToRichComment(contents: string): string {
    return contents.split(/\n/).map(line => `  ${line}`).join('\n').trim();
}

export function addRichComment(doc: EditableDocument, p = doc.selection.active, contents?: string) {
    const richComment = `(comment\n  ${contents ? adaptContentsToRichComment(contents) : ''}\n  )`;
    let cursor = doc.getTokenCursor(p);
    const topLevelRange = rangeForDefun(doc, p, false);
    const isInsideForm = !(p <= topLevelRange[0] || p >= topLevelRange[1]);
    const checkIfAtStartCursor = doc.getTokenCursor(p);
    checkIfAtStartCursor.backwardWhitespace(true);
    const isAtStart = checkIfAtStartCursor.atStart();
    if (isInsideForm || isAtStart) {
        cursor = doc.getTokenCursor(topLevelRange[1]);
    }
    const inLineComment = cursor.getPrevToken().type === 'comment' || cursor.getToken().type === 'comment';
    if (inLineComment) {
        cursor.forwardWhitespace(true);
        cursor.backwardWhitespace(false);
    }
    const insertStart = cursor.offsetStart;
    const insideNextTopLevelFormPos = rangeToForwardDownList(doc, insertStart)[1];
    if (!contents && insideNextTopLevelFormPos !== insertStart) {
        const checkIfRichCommentExistsCursor = doc.getTokenCursor(insideNextTopLevelFormPos);
        checkIfRichCommentExistsCursor.forwardWhitespace(true);
        if (checkIfRichCommentExistsCursor.getToken().raw == 'comment') {
            checkIfRichCommentExistsCursor.forwardSexp();
            checkIfRichCommentExistsCursor.forwardWhitespace(false);
            // insert nothing, just place cursor
            const newCursorPos = checkIfRichCommentExistsCursor.offsetStart;
            doc.model.edit([
                new ModelEdit('insertString', [newCursorPos, '', [newCursorPos, newCursorPos], [newCursorPos, newCursorPos]])
            ], {
                selection: new ModelEditSelection(newCursorPos),
                skipFormat: true,
                undoStopBefore: false
            });
            return;
        }
    }
    cursor.backwardWhitespace(false);
    const leftWs = doc.model.getText(cursor.offsetStart, insertStart);
    cursor.forwardWhitespace(false);
    const rightWs = doc.model.getText(insertStart, cursor.offsetStart);
    const numPrependNls = leftWs.match('\n\n') ? 0 : leftWs.match('\n') ? 1 : 2;
    const numAppendNls = rightWs.match('\n\n') ? 0 : rightWs.match('^\n') ? 1 : 2;
    const prepend = '\n'.repeat(numPrependNls);
    const append = '\n'.repeat(numAppendNls);
    const insertText = `${prepend}${richComment}${append}`;
    const newCursorPos = insertStart + 11 + numPrependNls * doc.model.lineEndingLength;
    doc.model.edit([
        new ModelEdit('insertString', [insertStart, insertText, [insertStart, insertStart], [newCursorPos, newCursorPos]])
    ], {
        selection: new ModelEditSelection(newCursorPos),
        skipFormat: false,
        undoStopBefore: true
    });
}