/**
 * A Scanner for Clojure.
 * 
 * Based on a pared down version of my lexer without a lot of other needless cruft relating to source information etc.
 * Unlike flex, this lexer doesn't support states, so we toggle between toplevel and string states by swapping lexers.
 * 
 * This is *not* a fully accurate lexer, since it needs to be robust in the face of junk.
 */
import { LexicalGrammar, Token as LexerToken } from "./lexer";


export interface Token extends LexerToken {
    state: ScannerState;
}

// The toplevel lexical grammar for Clojure.
let toplevel = new LexicalGrammar();

// whitespace
toplevel.terminal("[\\s,]+", (l, m) => ({ type: "ws" }))
// comments
toplevel.terminal(";.*", (l, m) => ({ type: "comment" }))
// open parens
toplevel.terminal("\\(|\\[|\\{|#\\(|#?\\(|#\\{|#?@\\(", (l, m) => ({ type: "open" }))
// close parens
toplevel.terminal("\\)|\\]|\\}", (l, m) => ({ type: "close" }))

// punctuators
toplevel.terminal("~@|~|'|#'|#:|#_|\\^|`|#|\\^:", (l, m) => ({ type: "punc" }))

toplevel.terminal("true|false|nil", (l, m) => ({type: "lit"}))
toplevel.terminal("[0-9]+[rR][0-9a-zA-Z]+", (l, m) => ({ type: "lit" }))
toplevel.terminal("[-+]?[0-9]+(\\.[0-9]+)?([eE][-+]?[0-9]+)?", (l, m) => ({ type: "lit" }))

toplevel.terminal(":[^()[\\]\\{\\}#,~@'`^\"\\s]+", (l, m) => ({ type: "lit" }))
// this is a REALLY lose symbol definition, but similar to how clojure really collects it. numbers/true/nil are all 
toplevel.terminal("[^()[\\]\\{\\}#,~@'`^\"\\s:][^()[\\]\\{\\}#,~@'`^\"\\s]*", (l, m) => ({ type: "id" }))
// complete string on a single line
toplevel.terminal('"([^"\\\\]|\\\\.)*"', (l, m) => ({ type: "str"}))

// begin a multiline string
toplevel.terminal('"([^"\\\\]|\\\\.)*', (l, m) => ({ type: "str-start"}))
toplevel.terminal('.', (l, m) => ({ type: "junk" }))


// Inside a multi-line string lexical grammar
let multstring = new LexicalGrammar()
// end a multiline string
multstring.terminal('([^"\\\\]|\\\\.)*"', (l, m) => ({ type: "str-end" }))
// still within a multiline string
multstring.terminal('([^"\\\\]|\\\\.)*', (l, m) => ({ type: "str-inside" }))

/** The state of the scanner */
export interface ScannerState {
    /** Are we scanning inside a string? If so use multstring grammar, otherwise use toplevel. */
    inString: boolean
}

export class Scanner {
    state: ScannerState = { inString: false };
    processLine(line: string, lineNumber: number, state: ScannerState = this.state) {
        let tks: Token[] = [];
        this.state = state;
        let lex = (this.state.inString ? multstring : toplevel).lex(line);
        let tk: LexerToken;
        do {
            tk = lex.scan();
            if(tk) {
                let oldpos = lex.position;
                switch(tk.type) {
                    case "str-end": // multiline string ended, switch back to toplevel
                        this.state = { ...this.state, inString: false};
                        lex = toplevel.lex(line);
                        lex.position = oldpos;
                        break;
                    case "str-start": // multiline string started, switch to multstring.
                        this.state = { ...this.state, inString: true};
                        lex = multstring.lex(line);
                        lex.position = oldpos;
                        break;
                }
                tks.push({ ...tk, state: this.state });
            }
        } while(tk);
        // insert a sentinel EOL value, this allows us to simplify TokenCaret's implementation.
        tks.push({ type: "eol", raw: "\n", offset: line.length, state: this.state })
        return tks;
    }
}