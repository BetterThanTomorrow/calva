/**
 * A Lexical analyser
 * @module lexer
 */

export interface Token {
    type: string;
    raw: string;
    offset: number;
}

export interface Rule {
    r: RegExp;
    fn: (Lexer, RegExpExecArray) => any
}

/**
 * A Lexer instance, parsing a given file.  Usually you should use a LexicalGrammar to
 * create one of these.
 *
 * @class
 * @param {string} source the source code to parse
 * @param rules the rules of this lexer.
 */
export class Lexer {
    position: number = 0;
    constructor(public source: string, public rules: Rule[]) {
    }

    peeked: any;

    peek() {
        return this.peeked = this.scan();
    }

    match(type: string, raw?: string) {
        let p = this.peek();
        if(p && p.type == type && (!raw || p.raw == raw)) {
            this.peeked = null;
            return true;
        }
        return false;
    }

    scan(): Token {
        if(this.peeked) {
            let res = this.peeked;
            this.peeked = null;
            return res;
        }
        var token = null;
        var length = 0;
        this.rules.forEach(rule => {
            rule.r.lastIndex = this.position;
            var x = rule.r.exec(this.source);
            if (x && x[0].length > length && this.position + x[0].length == rule.r.lastIndex) {
                token = rule.fn(this, x);
                token.offset = this.position;
                token.raw = x[0];
                length = x[0].length;
            }
        })
        this.position += length;
        if (token == null) {
            if(this.position == this.source.length)
                return null;
            throw new Error("Unexpected character at " + this.position + ": "+JSON.stringify(this.source));
        }
        return token;
    }
}

/**
 * A lexical grammar- factory for lexer instances.
 * @class
 */
export class LexicalGrammar {
    rules: Rule[] = [];

    /**
     * Defines a terminal with the given pattern and constructor.
     * @param {string} pattern the pattern this nonterminal must match.
     * @param {function(Array<string>): Object} fn returns a lexical token representing
     *        this terminal.  An additional "offset" property containing the token source position
     *        will also be added, as well as a "raw" property, containing the raw string match.
     */
    terminal(pattern: string, fn: (T, RegExpExecArray) => any): void {
        this.rules.push({ r: new RegExp(pattern, "g"), fn: fn })
    }

    lex(source: string): Lexer {
        return new Lexer(source, this.rules)
    }
}