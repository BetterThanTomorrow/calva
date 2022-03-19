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
  name: string;
  r: RegExp;
  fn: (Lexer, RegExpExecArray) => any;
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
  constructor(public source: string, public rules: Rule[], private maxLength) {}

  /** Returns the next token in this lexer, or null if at the end. If the match fails, throws an Error. */
  scan(): Token {
    let token = null,
      length = 0;
    if (this.position < this.source.length) {
      if (this.source !== undefined && this.source.length < this.maxLength) {
        // TODO: Consider using vscode setting for tokenisation max length
        this.rules.forEach((rule) => {
          rule.r.lastIndex = this.position;
          const x = rule.r.exec(this.source);
          if (x && x[0].length > length && this.position + x[0].length == rule.r.lastIndex) {
            token = rule.fn(this, x);
            token.offset = this.position;
            token.raw = x[0];
            length = x[0].length;
          }
        });
      } else {
        length = this.source.length;
        token = {
          type: 'too-long-line',
          offset: this.position,
          raw: this.source,
        };
      }
    }
    this.position += length;
    if (token == null) {
      if (this.position == this.source.length) {
        return null;
      }
      throw new Error(
        'Unexpected character at ' + this.position + ': ' + JSON.stringify(this.source)
      );
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
   * @param {string | RegExp} pattern the pattern this terminal must match.
   * @param {function(Array<string>): Object} fn returns a lexical token representing
   *        this terminal.  An additional "offset" property containing the token source position
   *        will also be added, as well as a "raw" property, containing the raw string match.
   */
  terminal(name: string, pattern: string | RegExp, fn: (T, RegExpExecArray) => any): void {
    this.rules.push({
      name,
      // This is b/c the RegExp constructor seems to not like our union type (unknown reasons why)
      r: pattern instanceof RegExp ? new RegExp(pattern, 'g') : new RegExp(pattern, 'g'),
      fn: fn,
    });
  }

  /**
   * Create a Lexer for the given input.
   */
  lex(source: string, maxLength): Lexer {
    return new Lexer(source, this.rules, maxLength);
  }
}
