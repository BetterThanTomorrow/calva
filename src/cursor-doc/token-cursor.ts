import { LineInputModel } from "./model";
import { Token } from "./clojure-lexer";


function tokenIsWhiteSpace(token: Token) {
    return token.type === 'eol' || token.type == 'ws';
}

/**
 * A mutable cursor into the token stream.
 */
export class TokenCursor {
    constructor(public doc: LineInputModel, public line: number, public token: number) {
    }

    /** Create a copy of this cursor. */
    clone() {
        return new TokenCursor(this.doc, this.line, this.token);
    }

    /**
     * Sets this TokenCursor state to the same as another.
     * @param cursor the cursor to copy state from.
     */
    set(cursor: TokenCursor) {
        this.doc = cursor.doc;
        this.line = cursor.line;
        this.token = cursor.token;
    }

    /** Return the position */
    get rowCol() {
        return [this.line, this.getToken().offset];
    }

    /** Return the offset at the start of the token */
    get offsetStart() {
        return this.doc.getOffsetForLine(this.line) + this.getToken().offset;
    }

    /** Return the offset at the end of the token */
    get offsetEnd() {
        return Math.min(this.doc.maxOffset, this.doc.getOffsetForLine(this.line) + this.getToken().offset + this.getToken().raw.length);
    }


    /** True if we are at the start of the document */
    atStart() {
        return this.token == 0 && this.line == 0;
    }

    /** True if we are at the end of the document */
    atEnd() {
        return this.line == this.doc.lines.length - 1 && this.token == this.doc.lines[this.line].tokens.length - 1;
    }

    /** Move this cursor backwards one token */
    previous() {
        if (this.token > 0) {
            this.token--;
        } else {
            if (this.line == 0) return;
            this.line--;
            this.token = this.doc.lines[this.line].tokens.length - 1;
        }
        return this;
    }

    /** Move this cursor forwards one token */
    next() {
        if (this.token < this.doc.lines[this.line].tokens.length - 1) {
            this.token++;
        } else {
            if (this.line == this.doc.lines.length - 1) return;
            this.line++;
            this.token = 0;
        }
        return this;
    }

    /**
     * Return the token immediately preceding this cursor. At the start of the file, a token of type "eol" is returned.
     */
    getPrevToken(): Token {
        if (this.line == 0 && this.token == 0)
            return { type: "eol", raw: "\n", offset: 0, state: null };
        let cursor = this.clone();
        cursor.previous();
        return cursor.getToken();
    }

    /**
     * Returns the token at this cursor position.
     */
    getToken() {
        return this.doc.lines[this.line].tokens[this.token];
    }

    equals(cursor: TokenCursor) {
        return this.line == cursor.line && this.token == cursor.token && this.doc == cursor.doc;
    }
}

export class LispTokenCursor extends TokenCursor {

    constructor(public doc: LineInputModel, public line: number, public token: number) {
        super(doc, line, token);
    }

    /** Create a copy of this cursor. */
    clone() {
        return new LispTokenCursor(this.doc, this.line, this.token);
    }

    /**
     * Moves this token past the inside of a multiline string
     */
    forwardString() {
        while (!this.atEnd()) {
            switch (this.getToken().type) {
                case "eol":
                case "str-inside":
                case "str-start":
                    this.next();
                    continue;
                default:
                    return;
            }
        }
    }

    /**
     * Moves this token past any whitespace or comment.
     */
    forwardWhitespace(includeComments = true) {
        while (!this.atEnd()) {
            switch (this.getToken().type) {
                case "comment":
                    if (!includeComments)
                        return;
                case "eol":
                case "ws":
                    this.next();
                    continue;
                default:
                    return;
            }
        }
    }

    /**
     * Moves this token back past any whitespace or comment.
     */
    backwardWhitespace(includeComments = true) {
        while (!this.atStart()) {
            switch (this.getPrevToken().type) {
                case "comment":
                    if (!includeComments)
                        return;
                case "eol":
                    this.previous();
                    if (this.getPrevToken().type == "comment") {
                        this.next();
                        return;
                    }
                    continue;
                case "ws":
                    this.previous();
                    continue;
                default:
                    return;
            }
        }
    }

    // Lisp navigation commands begin here.

    /**
     * Moves this token forward one s-expression at this level.
     * If the next non whitespace token is an open paren, skips past it's matching
     * close paren.
     * 
     * If the next token is a form of closing paren, does not move.
     * 
     * @returns true if the cursor was moved, false otherwise.
     */
    forwardSexp(skipComments = false): boolean {
        let delta = 0;
        this.forwardWhitespace(!skipComments);
        if (this.getToken().type == "close") {
            return false;
        }
        while (!this.atEnd()) {
            this.forwardWhitespace(!skipComments);
            let tk = this.getToken();
            switch (tk.type) {
                case 'comment':
                    this.next(); // skip past comment
                    this.next(); // skip past EOL.
                    return true;
                case 'id':
                case 'lit':
                case 'kw':
                case 'punc':
                case 'junk':
                case 'str':
                case 'str-end':
                    this.next();
                    if (delta <= 0)
                        return true;
                    break;
                case 'str-inside':
                case 'str-start':
                    do {
                        this.next();
                        tk = this.getToken();
                    } while (!this.atEnd() && (tk.type == "str-inside" || tk.type == "eol"))
                    continue;
                case 'close':
                    delta--;
                    this.next();
                    if (delta <= 0)
                        return true;
                    break;
                case 'open':
                    delta++;
                    this.next();
                    break;
                default:
                    this.next();
                    break;
            }
        }
    }

    /**
     * Moves this token backward one s-expression at this level.
     * If the previous non whitespace token is an close paren, skips past it's matching
     * open paren.
     * 
     * If the previous token is a form of open paren, does not move.
     * 
     * @returns true if the cursor was moved, false otherwise.
     */
    backwardSexp(skipComments = true) {
        let delta = 0;
        this.backwardWhitespace(!skipComments);
        switch (this.getPrevToken().type) {
            case "open":
                return false;
        }
        while (!this.atStart()) {
            this.backwardWhitespace(!skipComments);
            let tk = this.getPrevToken();
            switch (tk.type) {
                case 'id':
                case 'lit':
                case 'punc':
                case 'junk':
                case 'kw':
                case 'comment':
                case 'str':
                case 'str-start':
                    this.previous();
                    if (delta <= 0)
                        return true;
                    break;
                case 'str-inside':
                case 'str-end':
                    do {
                        this.previous();
                        tk = this.getPrevToken();
                    } while (!this.atStart() && tk.type == "str-inside")
                    continue;
                case 'close':
                    delta++;
                    this.previous();
                    break;
                case 'open':
                    delta--;
                    this.previous();
                    if (delta <= 0)
                        return true;
                    break;
                default:
                    this.previous();
            }
        }
    }

    /**
     * Moves this cursor to the close paren of the containing sexpr, or until the end of the document.
     */
    forwardList(): boolean {
        let cursor = this.clone();
        while (cursor.forwardSexp()) { }
        if (cursor.getToken().type == "close") {
            this.set(cursor);
            return true;
        }
        return false;
    }

    /**
     * Moves this cursor forwards to the `closingBracket` of the containing sexpr, or until the end of the document.
     */
    forwardListOfType(closingBracket: string): boolean {
        let cursor = this.clone();
        while (cursor.forwardList()) {
            if (cursor.getPrevToken().raw === closingBracket) {
                this.set(cursor);
                return true;
            }
            if (!cursor.upList()) {
                return false;
            }
        }
    }

    /**
     * Moves this cursor backwards to the open paren of the containing sexpr, or until the start of the document.
     */
    backwardList(): boolean {
        let cursor = this.clone();
        while (cursor.backwardSexp()) { }
        if (cursor.getPrevToken().type == "open") {
            this.set(cursor);
            return true;
        }
        return false;
    }

    /**
     * Moves this cursor backwards to the `openingBracket` of the containing sexpr, or until the start of the document.
     */
    backwardListOfType(openingBracket: string): boolean {
        let cursor = this.clone();
        while (cursor.backwardList()) {
            if (cursor.getPrevToken().raw === openingBracket) {
                this.set(cursor);
                return true;
            }
            if (!cursor.backwardUpList()) {
                return false;
            }
        }
    }

    /**
     * Finds the range of the current list. If you are particular about which type of list, supply the `openingBracket`
     * @param openingBracket 
     */
    rangeForList(openingBracket?: string): [[number, number], [number, number]] {
        const cursor = this.clone();
        if (openingBracket === undefined) {
            if (!(cursor.backwardList() && cursor.backwardUpList())) {
                return undefined;
            }
        } else {
            if (!(cursor.backwardListOfType(openingBracket) && cursor.backwardUpList())) {
                return undefined;
            }
        }
        const start = cursor.rowCol as [number, number];
        if (!cursor.forwardSexp()) {
            return undefined;
        }
        const end = cursor.rowCol as [number, number];
        return [start, end]
    }

    /**
     * If possible, moves this cursor forwards past any whitespace, and then past the immediately following open-paren and returns true.
     * If the source does not match this, returns false and does not move the cursor.
     */
    downList(): boolean {
        let cursor = this.clone();
        cursor.forwardWhitespace();
        if (cursor.getToken().type == "open") {
            cursor.next();
            this.set(cursor);
            return true;
        }
        return false;
    }

    /**
     * If possible, moves this cursor forwards past any whitespace, and then past the immediately following close-paren and returns true.
     * If the source does not match this, returns false and does not move the cursor.
     */
    upList(): boolean {
        let cursor = this.clone();
        cursor.forwardWhitespace();
        if (cursor.getToken().type == "close") {
            cursor.next();
            this.set(cursor);
            return true;
        }
        return false;
    }

    /**
     * If possible, moves this cursor backwards past any whitespace, and then backwards past the immediately following open-paren and returns true.
     * If the source does not match this, returns false and does not move the cursor.
     */
    backwardUpList(): boolean {
        let cursor = this.clone();
        cursor.backwardWhitespace();
        if (cursor.getPrevToken().type == "open") {
            cursor.previous();
            this.set(cursor);
            return true;
        }
        return false;
    }

    /**
     * If possible, moves this cursor backwards past any whitespace, and then backwards past the immediately following close-paren and returns true.
     * If the source does not match this, returns false and does not move the cursor.
     */
    backwardDownList(): boolean {
        let cursor = this.clone();
        cursor.backwardWhitespace();
        if (cursor.getPrevToken().type == "close") {
            cursor.previous();
            this.set(cursor);
            return true;
        }
        return false;
    }

    /**
     * Moves the cursor to the current form according to this priority:
     * 1. If not within whitespace, don't move, return `true`.
     * 2. Move adjacent to the form to the left, return `true`.
     * 3. Move adjacent to the form to the right, return `true`.
     * Otherwise, don't move, return `false`.
    */
    moveToCurrentForm(): boolean {
        let cursor = this.clone();
        const prevToken = cursor.getPrevToken();
        if (!cursor.withinWhiteSpace()) {
            return true;
        }
        if (cursor.isWhiteSpace()) {
            cursor.backwardWhitespace();
            if (!cursor.atStart()) {
                this.set(cursor);
                return true;
            }
        }
        cursor.forwardWhitespace();
        if (!cursor.atEnd()) {
            this.set(cursor);
            return true;
        }
        return false;
    }

    isWhiteSpace(): boolean {
        return tokenIsWhiteSpace(this.getToken());
    }

    previousIsWhiteSpace(): boolean {
        return tokenIsWhiteSpace(this.getPrevToken());
    }

    withinWhiteSpace(): boolean {
        return this.isWhiteSpace() && this.previousIsWhiteSpace();
    }

    /**
     * Indicates if the current token is inside a string (e.g. a documentation string)
     */
    withinString() {
        const strTypes = ['str', 'str-start', 'str-inside', 'str-end'],
            token = this.getToken();
        if (token.type == 'eol') {
            let next = this.clone().next()
            let previous = this.clone().previous();
            if (next && strTypes.includes(next.getToken().type) &&
                previous && strTypes.includes(previous.getToken().type)) {
                return (true);
            }
        } else if (strTypes.includes(token.type)) {
            return (true);
        }
        return false;
    }

    /**
     * Tells if the cursor is inside a properly closed list.
     */
    withinValidList(): boolean {
        let cursor = this.clone();
        while (cursor.forwardSexp()) { }
        return cursor.getToken().type == "close";
    }

    /**
     * Returns the ranges for all forms in the current list.
     * Returns undefined if the current cursor is not within a list.
     * If you are particular about which list type that should be considered, supply an `openingBracket`.
     */
    rangesForSexpsInList(openingBracket?: string): [[number, number], [number, number]][] {
        let cursor = this.clone();
        if (openingBracket !== undefined) {
            if (!cursor.backwardListOfType(openingBracket)) {
                return undefined;
            }
        } else {
            if (!cursor.backwardList()) {
                return undefined;
            }
        }
        let ranges = [];
        // TODO: Figure out how to do this ignore skipping more generally in forward/backward this or that.
        let ignoreCounter = 0;
        while (true) {
            cursor.forwardWhitespace();
            const start = cursor.rowCol;
            if (cursor.getToken().raw === '#_') {
                ignoreCounter++;
                cursor.forwardSexp();
                continue;
            }
            if (cursor.forwardSexp()) {
                if (ignoreCounter === 0) {
                    const end = cursor.rowCol;
                    ranges.push([start, end]);
                } else {
                    ignoreCounter--;
                }
            } else {
                break;
            }
        }
        return ranges;
    }

    /**
     * Tries to move this cursor backwards to the open paren of the function, `level` functions up.
     * If there aren't that many functions behind the cursor, the cursor is not moved at all.
     * @param levels how many functions up to go before placing the cursor at the start of it.
     * @returns `true` if the cursor was moved, otherwise `false`
     */
    backwardFunction(levels: number = 0): boolean {
        const cursor = this.clone();
        if (!cursor.backwardListOfType('(')) {
            return false;
        }
        for (let i = 0; i < levels; i++) {
            if (!cursor.backwardUpList()) {
                return false;
            }
            if (!cursor.backwardListOfType('(')) {
                return false;
            }
        }
        this.set(cursor);
        return true;
    }

    /**
     * Get the name of the current function, optionally digging `levels` functions up.
     * @param levels how many levels of functions to dig up.
     * @returns the function name, or undefined if there is no function there.
     */
    getFunction(levels: number = 0): string {
        const cursor = this.clone();
        if (cursor.backwardFunction(levels)) {
            cursor.forwardWhitespace();
            const symbol = cursor.getToken();
            if (symbol.type === 'id') {
                return symbol.raw;
            }
        }
    }
}

/**
 * Creates a `LispTokenCursor` for walking and manipulating the string `s`.
 */
export function createStringCursor(s: string): LispTokenCursor {
    const model = new LineInputModel();
    model.insertString(0, s);
    return model.getTokenCursor(0);
} 