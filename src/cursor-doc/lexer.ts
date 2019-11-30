/**
 * A Lexical analyser
 * @module lexer
 */

/**
 * The base Token class. Contains the token type,
 * the raw string of the token, and the offset into the input line.
 */
export interface Token {
    type: string;
    raw: string;
    offset: number;
}

/**
 * A Lexical rule for a terminal. Consists of a RegExp and an action.
 */
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

    private positions: Map<number, any[]> = new Map<number, any[]>();

    constructor(public source: string, public rules: Rule[]) {

        this.rules.forEach(rule => {
            rule.r.lastIndex = 0
            let x = rule.r.exec(source);
            while(x) {
                if(x && x[0]) {
                    x.input = undefined;
                    x["rule"] = rule;
                    let position =  rule.r.lastIndex - x[0].length;
                    let values = this.positions.get(position);
                    if(values) {
                        values.push(x);
                        this.positions.set(position,values);
                    } else {
                        this.positions.set(position, [x]);
                    }
                }
                x = rule.r.exec(source);
            }
        })
    }

    /** Returns the next token in this lexer, or null if at the end. If the match fails, throws an Error. */
    scan(): Token {
        let [token, length] = this.lookup();
        if (token == null) {
            if (this.position == this.source.length) {
                return null;
            }
            [token, length] = this.retrieve();
            if (token == null) {
                throw new Error("Unexpected character at " + this.position + ": " + JSON.stringify(this.source));
            }
        }
        this.position += length;
        return token;
    }

    private lookup(): [Token, number] {
        var token = null;
        var length = 0;
        let values = this.positions.get(this.position);
        if(values) {
            values.forEach( x => {
                if (x && x[0].length > length) {
                    token = x["rule"].fn(this, x);
                    token.offset = this.position;
                    token.raw = x[0];
                    length = x[0].length;
                }
            }) 
        }
        return ([token, length]);
    }

     private retrieve(): [Token, number] {
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
        return ([token, length]);
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
     * @param {string | RegExp} pattern the pattern this terminal must match.
     * @param {function(Array<string>): Object} fn returns a lexical token representing
     *        this terminal.  An additional "offset" property containing the token source position
     *        will also be added, as well as a "raw" property, containing the raw string match.
     */
    terminal(pattern: string | RegExp, fn: (T, RegExpExecArray) => any): void {
        this.rules.push({
            // This is b/c the RegExp constructor seems to not like our union type (unknown reasons why)
            r: pattern instanceof RegExp ? new RegExp(pattern, "g") : new RegExp(pattern, "g"),
            fn: fn
        });
    }

    /**
     * Create a Lexer for the given input.
     */
    lex(source: string): Lexer {
        return new Lexer(source, this.rules)
    }
}