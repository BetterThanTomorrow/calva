import { LineInputModel } from "./model";
import { Token } from "./clojure-lexer";

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
        return this.doc.getOffsetForLine(this.line) +  this.getToken().offset;
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
        return this.line == this.doc.lines.length-1 && this.token == this.doc.lines[this.line].tokens.length-1;
    }

    /** Move this cursor backwards one token */
    previous() {
        if(this.token > 0) {
            this.token--;
        } else {
            if(this.line == 0) return;
            this.line--;
            this.token = this.doc.lines[this.line].tokens.length-1;
        }
        return this;
    }

    /** Move this cursor forwards one token */
    next() {
        if(this.token < this.doc.lines[this.line].tokens.length-1) {
            this.token++;
        } else {
            if(this.line == this.doc.lines.length-1) return;
            this.line++;
            this.token = 0;
        }
        return this;
    }

    /**
     * Return the token immediately preceding this cursor. At the start of the file, a token of type "eol" is returned.
     */
    getPrevToken(): Token {
        if(this.line == 0 && this.token == 0)
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
    fowardString() {
        while(!this.atEnd()) {
            switch(this.getToken().type) {
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
        while(!this.atEnd()) {
            switch(this.getToken().type) {
                case "comment":
                    if(!includeComments)
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
        while(!this.atStart()) {
            switch(this.getPrevToken().type) {
                case "comment":
                    if(!includeComments)
                        return;
                case "eol":
                    this.previous();
                    if(this.getPrevToken().type == "comment") {
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
        if(this.getToken().type == "close") {
            return false;
        }
        while(!this.atEnd()) {
            this.forwardWhitespace(!skipComments);
            let tk = this.getToken();
            switch(tk.type) {
                case 'comment':
                    this.next(); // skip past comment
                    this.next(); // skip past EOL.
                    return true;
                case 'id':
                case 'lit':
                case 'kw':
                case 'str':
                case 'str-end':
                    this.next();
                    if(delta <= 0)
                        return true;
                    break;
                case 'str-inside':
                case 'str-start':
                    do {
                        this.next();
                        tk = this.getToken();
                    } while(!this.atEnd() && (tk.type == "str-inside" || tk.type == "eol"))
                    continue;
                case 'close':
                    delta--;
                    this.next();
                    if(delta <= 0)
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
        switch(this.getPrevToken().type) {
            case "open":
                return false;
        }
        while(!this.atStart()) {
            this.backwardWhitespace(!skipComments);
            let tk = this.getPrevToken();
            switch(tk.type) {
                case 'id':
                case 'lit':
                case 'kw':
                case 'comment':
                case 'str':
                case 'str-start':
                    this.previous();
                    if(delta <= 0)
                        return true;
                    break;
                case 'str-inside':
                case 'str-end':
                    do {
                        this.previous();
                        tk = this.getPrevToken();
                    } while(!this.atStart() && tk.type == "str-inside")
                    continue;
                case 'close':
                    delta++;
                    this.previous();
                    break;
                case 'open':
                    delta--;
                    this.previous();
                    if(delta <= 0)
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
        while(cursor.forwardSexp()) { }
        if(cursor.getToken().type == "close") {
            this.set(cursor);
            return true;
        }
        return false;
    }

    /**
     * Moves this cursor backwards to the open paren of the containing sexpr, or until the start of the document.
     */
    backwardList(): boolean {
        let cursor = this.clone();
        while(cursor.backwardSexp()) { }
        if(cursor.getPrevToken().type == "open") {
            this.set(cursor);
            return true;
        }
        return false;
    }

    /**
     * If possible, moves this cursor forwards past any whitespace, and then past the immediately following open-paren and returns true.
     * If the source does not match this, returns false and does not move the cursor.
     */
    downList(): boolean {
        let cursor = this.clone();
        cursor.forwardWhitespace();
        if(cursor.getToken().type == "open") {
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
        if(cursor.getToken().type == "close") {
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
        if(cursor.getPrevToken().type == "open") {
            cursor.previous();
            this.set(cursor);
            return true;
        }
        return false;
    }

    withinWhitespace() {
        let tk = this.getToken().type;
        if(tk == "eol" || tk == "ws") {
            return true;
        }
    }
    withinString() {
        let tk = this.getToken().type;
        if(tk == "str" || tk == "str-start" || tk == "str-end" || tk == "str-inside") {
            return true;
        }
        if(tk == "eol") {
            tk = this.getPrevToken().type;
            if(tk == "str-inside" || tk == "str-start")
                return true;
        }
        return false;
    }
}
