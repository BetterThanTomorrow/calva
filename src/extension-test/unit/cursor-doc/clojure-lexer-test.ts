import * as expect from 'expect';
import * as fc from 'fast-check';
import { Scanner, toplevel, validPair } from '../../../cursor-doc/clojure-lexer';

const MAX_LINE_LENGTH = 100;

// fast-check Arbritraries

// TODO: single quotes are valid in real Clojure, but Calva can't handle them in symbols yet
const wsChars = [
  ',',
  ' ',
  '\t',
  '\n',
  '\r',
  '\f',
  ...'\u000B\u001C\u001D\u001E\u001F\u2028\u2029\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2008\u2009\u200a\u205f\u3000',
];
const openChars = ['"', '(', '[', '{'];
const closeChars = ['"', ')', ']', '}'];
const formPrefixChars = ["'", '@', '~', '`', '^', ','];
const nonSymbolChars = [
  ...wsChars,
  ...[';', '@', '~', '`', '^', '\\'],
  ...openChars,
  ...closeChars,
];

function symbolChar(): fc.Arbitrary<string> {
  // We need to filter away all kinds of whitespace, therefore the regex...
  return fc.unicode().filter((c) => !(nonSymbolChars.includes(c) || c.match(/\s/)));
}

function formPrefixChar(): fc.Arbitrary<string> {
  return fc.constantFrom(...formPrefixChars);
}

function open(): fc.Arbitrary<string> {
  return fc
    .tuple(
      fc.stringOf(formPrefixChar(), 0, 3),
      fc.stringOf(fc.constantFrom(...[' ', '\t']), 0, 2),
      fc.constantFrom(...openChars)
    )
    .map(([p, ws, o]) => `${p}${ws}${o}`);
}

function close(): fc.Arbitrary<string> {
  return fc.constantFrom(...closeChars);
}

function symbolStartIncludingDigit(): fc.Arbitrary<string> {
  return fc
    .tuple(symbolChar(), symbolChar(), symbolChar())
    .map(([c1, c2, c3]) => `${c1}${c2}${c3}`)
    .filter((s) => !!s.match(/^(?:[^#:]|#'[^'])/));
}

function symbolStart(): fc.Arbitrary<string> {
  return symbolStartIncludingDigit().filter((s) => !s.match(/^\d/));
}

function symbol(): fc.Arbitrary<string> {
  return fc.tuple(symbolStart(), fc.stringOf(symbolChar(), 1, 5)).map(([c, s]) => `${c}${s}`);
}

function underscoreSymbol(): fc.Arbitrary<string> {
  return fc
    .tuple(fc.constant('_'), symbolStartIncludingDigit(), fc.stringOf(symbolChar(), 1, 5))
    .map(([c, s]) => `${c}${s}`);
}

function keyword(): fc.Arbitrary<string> {
  return fc.tuple(fc.constantFrom(':'), symbol()).map(([c, s]) => `${c}${s}`);
}

function wsChar(): fc.Arbitrary<string> {
  return fc.constantFrom(...wsChars);
}

function ws(): fc.Arbitrary<string> {
  return fc.stringOf(wsChar(), 1, 3);
}

function nonWsChar(): fc.Arbitrary<string> {
  return fc.unicode().filter((c) => !(wsChars.includes(c) || c.match(/\s/)));
}

function nonWs(): fc.Arbitrary<string> {
  return fc.stringOf(nonWsChar(), 1, 3);
}

function quotedUnicode(): fc.Arbitrary<string> {
  return fc.tuple(fc.constantFrom('\\'), fc.unicode()).map(([c, s]) => `${c}${s}`);
}

function list(): fc.Arbitrary<string> {
  return fc
    .tuple(open(), symbol(), close())
    .filter(([o, _s, c]) => {
      return validPair(o[o.length - 1], c);
    })
    .map(([o, s, c]) => `${o}${s}${c}`);
}

function selectKeysTypeRaw(tokens: any[]) {
  return tokens.slice(0, tokens.length - 1).map((t) => {
    return { type: t.type, raw: t.raw };
  });
}

function testTokens(data) {
  return data.map((d) => {
    return { type: d[0], raw: d[1] };
  });
}

describe('Scanner', () => {
  let scanner: Scanner;

  beforeEach(() => {
    scanner = new Scanner(MAX_LINE_LENGTH);
  });

  describe('simple', () => {
    describe('symbols', () => {
      it('tokenizes any symbol', () => {
        fc.assert(
          fc.property(symbol(), (data) => {
            const tokens = scanner.processLine(data);
            expect(tokens[0].type).toBe('id');
            expect(tokens[0].raw).toBe(data);
          })
        );
      });
      it('tokenizes symbols starting with _', () => {
        fc.assert(
          fc.property(underscoreSymbol(), (data) => {
            const tokens = scanner.processLine(data);
            expect(tokens[0].type).toBe('id');
            expect(tokens[0].raw).toBe(data);
          })
        );
      });
      it('tokenizes _ as a symbol', () => {
        const tokens = scanner.processLine('_');
        expect(tokens[0].type).toBe('id');
        expect(tokens[0].raw).toBe('_');
      });
      it('does not tokenize something with leading digit as a symbol', () => {
        const tokens = scanner.processLine('1foo');
        expect(tokens[0].type).toBe('lit');
        expect(tokens[0].raw).toBe('1');
        expect(tokens[1].type).toBe('id');
        expect(tokens[1].raw).toBe('foo');
      });
    });
    it('tokenizes whitespace', () => {
      fc.assert(
        fc.property(ws(), (data) => {
          // Remove extra eol put in there by the scanner
          const tokens = scanner.processLine(data).slice(0, -1);
          expect(tokens.map((t) => t.raw).join('')).toBe(data);
          tokens.forEach((t) => {
            expect(t.type).toBe('ws');
          });
        })
      );
      const tokens = scanner.processLine('foo   bar');
      expect(tokens[1].type).toBe('ws');
      expect(tokens[1].raw).toBe('   ');
    });
    describe('numbers', () => {
      it('tokenizes ints', () => {
        fc.assert(
          fc.property(
            fc.constantFrom(...['42', '0', '-007', '+42', '-0', '-42', '+3r11', '-25Rn', '00M']),
            (text) => {
              const tokens = scanner.processLine(text);
              expect(tokens[0].type).toBe('lit');
              expect(tokens[0].raw).toBe(text);
            }
          )
        );
      });
      it('tokenizes decimals', () => {
        fc.assert(
          fc.property(
            fc.constantFrom(
              ...[
                '4.2',
                '0.0',
                '+42.78',
                '-0.0',
                '42.0',
                '0042.0',
                '+18998.18998e+18998M',
                '-01.18e+18M',
                '-61E-19471M',
              ]
            ),
            (text) => {
              const tokens = scanner.processLine(text);
              expect(tokens[0].type).toBe('lit');
              expect(tokens[0].raw).toBe(text);
            }
          )
        );
      });
      it('tokenizes hex', () => {
        fc.assert(
          fc.property(
            fc.constantFrom(
              ...[
                '0xf',
                '0xCafeBabe',
                '0x0',
                '+0X0',
                '-0xFAF',
                '0x3B85110',
                '0xfN',
                '0xCafeBabeN',
                '0x0N',
                '+0X0N',
                '-0xFAFN',
                '0x3B85110N',
              ]
            ),
            (text) => {
              const tokens = scanner.processLine(text);
              expect(tokens[0].type).toBe('lit');
              expect(tokens[0].raw).toBe(text);
            }
          )
        );
      });
      it('tokenizes octal', () => {
        fc.assert(
          fc.property(
            fc.constantFrom(
              ...[
                '07',
                '007',
                '+01',
                '-01234567',
                '-0344310433453',
                '07N',
                '007N',
                '+01N',
                '-01234567N',
                '-0344310433453N',
              ]
            ),
            (text) => {
              const tokens = scanner.processLine(text);
              expect(tokens[0].type).toBe('lit');
              expect(tokens[0].raw).toBe(text);
            }
          )
        );
      });
      it('tokenizes ratios', () => {
        fc.assert(
          fc.property(fc.constantFrom(...['1/2', '01/02', '-100/200', '+1/0']), (text) => {
            const tokens = scanner.processLine(text);
            expect(tokens[0].type).toBe('lit');
            expect(tokens[0].raw).toBe(text);
          })
        );
      });
      it('tokenizes symbolic values', () => {
        fc.assert(
          fc.property(
            fc.constantFrom(
              ...['##Inf', '##-Inf', '##,, Inf', '## Inf', '## -Inf', '##NaN', '##  NaN']
            ),
            (text) => {
              const tokens = scanner.processLine(text);
              expect(tokens[0].type).toBe('lit');
              expect(tokens[0].raw).toBe(text);
            }
          )
        );
      });
      it('tokenizes symbolic values with comments appended', () => {
        fc.assert(
          fc.property(
            fc.constantFrom(
              ...['##Inf;', '##-Inf;comment', '## -Inf; comment', '##NaN;', '## NaN;comment']
            ),
            (text) => {
              const tokens = scanner.processLine(text);
              expect(tokens[0].type).toBe('lit');
              expect(tokens[0].raw).toBe(text.substr(0, text.indexOf(';')));
              expect(tokens[1].type).toBe('comment');
              expect(tokens[1].raw).toBe(text.substr(text.indexOf(';')));
            }
          )
        );
      });
      it('tokenizes symbolic values with backslash appended', () => {
        fc.assert(
          fc.property(
            fc.constantFrom(
              ...['##Inf\\', '##-Inf\\comment', '## -Inf\\ comment', '##NaN\\', '## NaN\\comment']
            ),
            (text) => {
              const tokens = scanner.processLine(text);
              expect(tokens[0].type).toBe('lit');
              expect(tokens[0].raw).toBe(text.substr(0, text.indexOf('\\')));
            }
          )
        );
      });
    });
    it('tokenizes keyword', () => {
      fc.assert(
        fc.property(keyword(), (data) => {
          const tokens = scanner.processLine(data);
          expect(tokens[0].type).toBe('kw');
          expect(tokens[0].raw).toBe(data);
        })
      );
    });
    describe('tokenizes literal characters', () => {
      it('tokenizes literal unicode characters', () => {
        fc.assert(
          fc.property(quotedUnicode(), (data) => {
            const tokens = scanner.processLine(data);
            expect(tokens[0].type).toBe('lit');
            expect(tokens[0].raw).toBe(data);
          })
        );
      });
      it('tokenizes backslash', () => {
        fc.assert(
          fc.property(fc.constantFrom(...['\\']), (data) => {
            const tokens = scanner.processLine(data);
            expect(tokens[0].type).toBe('lit');
            expect(tokens[0].raw).toBe(data);
          })
        );
      });
      it('tokenizes literal whitespace and control characters', () => {
        fc.assert(
          fc.property(
            fc.constantFrom(
              ...[' ', '\b', '\t', '\r', '\n', '\f', '\0', '\\'].map((c) => `\\${c}`)
            ),
            (data) => {
              const tokens = scanner.processLine(data);
              expect(tokens[0].type).toBe('lit');
              expect(tokens[0].raw).toBe(data);
            }
          )
        );
        const data = '\\\b';
        const tokens = scanner.processLine(data);
        expect(tokens[0].type).toBe('lit');
        expect(tokens[0].raw).toBe(data);
      });
      it('tokenizes named literals', () => {
        fc.assert(
          fc.property(
            fc.constantFrom(...['\\space', '\\space,', '\\space;', '\\space ', '\\space\\newline']),
            (text) => {
              const tokens = scanner.processLine(text);
              expect(tokens[0].type).toBe('lit');
              expect(tokens[0].raw).toBe('\\space');
            }
          )
        );
      });
      it('tokenizes literals with comments appended', () => {
        fc.assert(
          fc.property(
            fc.constantFrom(...['\\newline;', '\\space;comment', '\\space; comment', '1;', '+1;']),
            (text) => {
              const tokens = scanner.processLine(text);
              expect(tokens[0].type).toBe('lit');
              expect(tokens[0].raw).toBe(text.substr(0, text.indexOf(';')));
              expect(tokens[1].type).toBe('comment');
              expect(tokens[1].raw).toBe(text.substr(text.indexOf(';')));
            }
          )
        );
      });
      it('tokenizes numeric literals with ignores appended', () => {
        fc.assert(
          fc.property(fc.constantFrom(...['1#_', '+1#_', '-12#_', '4.2#_', '42.2#_']), (text) => {
            const tokens = scanner.processLine(text);
            expect(selectKeysTypeRaw(tokens)).toEqual(
              testTokens([
                ['lit', text.substr(0, text.indexOf('#_'))],
                ['ignore', '#_'],
              ])
            );
          })
        );
      });
    });
    it('tokenizes literal named character', () => {
      const tokens = scanner.processLine('\\space');
      expect(tokens[0].type).toBe('lit');
      expect(tokens[0].raw).toBe('\\space');
    });
    it('tokenizes line comments', () => {
      const tokens = scanner.processLine('; foo');
      expect(tokens[0].type).toBe('comment');
      expect(tokens[0].raw).toBe('; foo');
    });
    describe('tokenizes ignores', () => {
      it('sole, no ws', () => {
        const tokens = scanner.processLine('#_foo');
        expect(tokens[0].type).toBe('ignore');
        expect(tokens[0].raw).toBe('#_');
        expect(tokens[1].type).toBe('id');
        expect(tokens[1].raw).toBe('foo');
      });
      it('sole, trailing ws', () => {
        const tokens = scanner.processLine('#_ foo');
        expect(tokens[0].type).toBe('ignore');
        expect(tokens[0].raw).toBe('#_');
        expect(tokens[1].type).toBe('ws');
        expect(tokens[1].raw).toBe(' ');
        expect(tokens[2].type).toBe('id');
        expect(tokens[2].raw).toBe('foo');
      });
      it('sole, leading symbol/id, no ws', () => {
        const tokens = scanner.processLine('foo#_bar');
        expect(tokens[0].type).toBe('id');
        expect(tokens[0].raw).toBe('foo#_bar');
      });
      it('sole, leading number, no ws', () => {
        const tokens = scanner.processLine('1.2#_foo');
        expect(tokens[0].type).toBe('lit');
        expect(tokens[0].raw).toBe('1.2');
        expect(tokens[1].type).toBe('ignore');
        expect(tokens[1].raw).toBe('#_');
        expect(tokens[2].type).toBe('id');
        expect(tokens[2].raw).toBe('foo');
      });
      it('many, no ws', () => {
        const tokens = scanner.processLine('#_#_#_foo');
        expect(tokens[0].type).toBe('ignore');
        expect(tokens[0].raw).toBe('#_');
        expect(tokens[1].type).toBe('ignore');
        expect(tokens[1].raw).toBe('#_');
        expect(tokens[2].type).toBe('ignore');
        expect(tokens[2].raw).toBe('#_');
        expect(tokens[3].type).toBe('id');
        expect(tokens[3].raw).toBe('foo');
      });
      it('adjacent after literals it is part of the token', () => {
        fc.assert(
          fc.property(fc.constantFrom(...['\\c#_']), (text) => {
            const tokens = scanner.processLine(text);
            expect(tokens[0].raw).toBe(text);
          })
        );
      });
    });
    it('tokenizes the Calva repl prompt', () => {
      const tokens = scanner.processLine('foo꞉bar.baz꞉> ()');
      expect(tokens[0].type).toBe('prompt');
      expect(tokens[0].raw).toBe('foo꞉bar.baz꞉> ');
      expect(tokens[1].type).toBe('open');
      expect(tokens[1].raw).toBe('(');
      expect(tokens[2].type).toBe('close');
      expect(tokens[2].raw).toBe(')');
    });
    it('only tokenizes the Calva repl prompt if it is at the start of a line', () => {
      const tokens = scanner.processLine(' foo꞉bar.baz꞉> ()');
      expect(tokens[0].type).toBe('ws');
      expect(tokens[0].raw).toBe(' ');
      expect(tokens[1].type).toBe('id');
      expect(tokens[1].raw).toBe('foo꞉bar.baz꞉>');
      expect(tokens[2].type).toBe('junk');
      expect(tokens[2].raw).toBe(' ');
      expect(tokens[3].type).toBe('open');
      expect(tokens[3].raw).toBe('(');
      expect(tokens[4].type).toBe('close');
      expect(tokens[4].raw).toBe(')');
    });
    it('only tokenizes the Calva repl prompt if it ends with a space', () => {
      const tokens = scanner.processLine('foo꞉bar.baz꞉>()');
      expect(tokens[0].type).toBe('id');
      expect(tokens[0].raw).toBe('foo꞉bar.baz꞉>');
      expect(tokens[1].type).toBe('open');
      expect(tokens[1].raw).toBe('(');
      expect(tokens[2].type).toBe('close');
      expect(tokens[2].raw).toBe(')');
    });
  });
  describe('lists', () => {
    it('tokenizes list/vector/map/string', () => {
      fc.assert(
        fc.property(list(), (data) => {
          const tokens = scanner.processLine(data);
          const numTokens = tokens.length;
          expect(tokens[numTokens - 4].type).toBe('open');
          expect(tokens[numTokens - 2].type).toBe('close');
        })
      );
    });
    it('tokenizes list', () => {
      const tokens = scanner.processLine('(foo)');
      expect(tokens[0].type).toBe('open');
      expect(tokens[0].raw).toBe('(');
      expect(tokens[1].type).toBe('id');
      expect(tokens[1].raw).toBe('foo');
      expect(tokens[2].type).toBe('close');
      expect(tokens[2].raw).toBe(')');
    });
    it('tokenizes vector', () => {
      const tokens = scanner.processLine('[foo]');
      expect(tokens[0].type).toBe('open');
      expect(tokens[0].raw).toBe('[');
      expect(tokens[1].type).toBe('id');
      expect(tokens[1].raw).toBe('foo');
      expect(tokens[2].type).toBe('close');
      expect(tokens[2].raw).toBe(']');
    });
    it('tokenizes map', () => {
      const tokens = scanner.processLine('{:foo bar}');
      expect(tokens[0].type).toBe('open');
      expect(tokens[0].raw).toBe('{');
      expect(tokens[1].type).toBe('kw');
      expect(tokens[1].raw).toBe(':foo');
      expect(tokens[2].type).toBe('ws');
      expect(tokens[2].raw).toBe(' ');
      expect(tokens[3].type).toBe('id');
      expect(tokens[3].raw).toBe('bar');
      expect(tokens[4].type).toBe('close');
      expect(tokens[4].raw).toBe('}');
    });
    it('tokenizes shorthand lambda', () => {
      const tokens = scanner.processLine('#(foo bar)');
      expect(tokens[0].type).toBe('open');
      expect(tokens[0].raw).toBe('#(');
      expect(tokens[1].type).toBe('id');
      expect(tokens[1].raw).toBe('foo');
      expect(tokens[2].type).toBe('ws');
      expect(tokens[2].raw).toBe(' ');
      expect(tokens[3].type).toBe('id');
      expect(tokens[3].raw).toBe('bar');
      expect(tokens[4].type).toBe('close');
      expect(tokens[4].raw).toBe(')');
    });
    it('tokenizes set', () => {
      const tokens = scanner.processLine('#{:foo :bar}');
      expect(tokens[0].type).toBe('open');
      expect(tokens[0].raw).toBe('#{');
      expect(tokens[1].type).toBe('kw');
      expect(tokens[1].raw).toBe(':foo');
      expect(tokens[2].type).toBe('ws');
      expect(tokens[2].raw).toBe(' ');
      expect(tokens[3].type).toBe('kw');
      expect(tokens[3].raw).toBe(':bar');
      expect(tokens[4].type).toBe('close');
      expect(tokens[4].raw).toBe('}');
    });
    it('tokenizes string', () => {
      const tokens = scanner.processLine('"foo"');
      expect(tokens[0].type).toBe('open');
      expect(tokens[0].raw).toBe('"');
      expect(tokens[1].type).toBe('str-inside');
      expect(tokens[1].raw).toBe('foo');
      expect(tokens[2].type).toBe('close');
      expect(tokens[2].raw).toBe('"');
    });
    it('tokenizes regex', () => {
      const tokens = scanner.processLine('#"foo"');
      expect(tokens[0].type).toBe('open');
      expect(tokens[0].raw).toBe('#"');
      expect(tokens[1].type).toBe('str-inside');
      expect(tokens[1].raw).toBe('foo');
      expect(tokens[2].type).toBe('close');
      expect(tokens[2].raw).toBe('"');
    });
    it('tokenizes the `#` in `#[]` separately', () => {
      const tokens = scanner.processLine('#[foo bar]');
      expect(tokens[0].type).toBe('junk');
      expect(tokens[0].raw).toBe('#');
      expect(tokens[1].type).toBe('open');
      expect(tokens[1].raw).toBe('[');
      expect(tokens[2].type).toBe('id');
      expect(tokens[2].raw).toBe('foo');
      expect(tokens[3].type).toBe('ws');
      expect(tokens[3].raw).toBe(' ');
      expect(tokens[4].type).toBe('id');
      expect(tokens[4].raw).toBe('bar');
      expect(tokens[5].type).toBe('close');
      expect(tokens[5].raw).toBe(']');
    });
  });
  describe('data reader tags', () => {
    it('tokenizes tag, separate line', () => {
      const tokens = scanner.processLine('#foo');
      expect(tokens[0].type).toBe('reader');
      expect(tokens[0].raw).toBe('#foo');
    });
    it('tokenizes tag, with underscores', () => {
      const tokens = scanner.processLine('#foo_bar');
      expect(tokens[0].type).toBe('reader');
      expect(tokens[0].raw).toBe('#foo_bar');
    });
    it('does not treat var quote plus open token as reader tag plus open token', () => {
      const tokens = scanner.processLine("#'foo []");
      expect(tokens[0].type).toBe('id');
      expect(tokens[0].raw).toBe("#'foo");
      expect(tokens[1].type).toBe('ws');
      expect(tokens[1].raw).toBe(' ');
      expect(tokens[2].type).toBe('open');
      expect(tokens[2].raw).toBe('[');
      expect(tokens[3].type).toBe('close');
      expect(tokens[3].raw).toBe(']');
    });
  });
  describe('strings', () => {
    it('tokenizes words in strings', () => {
      const tokens = scanner.processLine('"(foo :bar)"');
      expect(tokens[0].type).toBe('open');
      expect(tokens[0].raw).toBe('"');
      expect(tokens[1].type).toBe('str-inside');
      expect(tokens[1].raw).toBe('(foo');
      expect(tokens[2].type).toBe('ws');
      expect(tokens[2].raw).toBe(' ');
      expect(tokens[3].type).toBe('str-inside');
      expect(tokens[3].raw).toBe(':bar)');
      expect(tokens[4].type).toBe('close');
      expect(tokens[4].raw).toBe('"');
    });
    it('tokenizes newlines in strings', () => {
      const tokens = scanner.processLine('"foo\nbar"');
      expect(tokens[0].type).toBe('open');
      expect(tokens[0].raw).toBe('"');
      expect(tokens[1].type).toBe('str-inside');
      expect(tokens[1].raw).toBe('foo');
      expect(tokens[2].type).toBe('ws');
      expect(tokens[2].raw).toBe('\n');
      expect(tokens[3].type).toBe('str-inside');
      expect(tokens[3].raw).toBe('bar');
      expect(tokens[4].type).toBe('close');
      expect(tokens[4].raw).toBe('"');
    });
    it('tokenizes quoted quotes in strings', () => {
      let tokens = scanner.processLine('"\\""');
      expect(tokens[0].type).toBe('open');
      expect(tokens[0].raw).toBe('"');
      expect(tokens[1].type).toBe('str-inside');
      expect(tokens[1].raw).toBe('\\"');
      tokens = scanner.processLine('"foo\\"bar"');
      expect(tokens[1].type).toBe('str-inside');
      expect(tokens[1].raw).toBe('foo\\"bar');
    });
  });
  describe('Reported issues', () => {
    it('too long lines - #566', () => {
      // https://github.com/BetterThanTomorrow/calva/issues/556
      const longLine = 'foo '.repeat(26),
        tokens = scanner.processLine(longLine);
      expect(tokens[0].type).toBe('too-long-line');
      expect(tokens[0].raw).toBe(longLine);
    });
    it('handles literal quotes - #566', () => {
      // https://github.com/BetterThanTomorrow/calva/issues/566
      const tokens = scanner.processLine("\\' foo");
      expect(tokens[0].type).toBe('lit');
      expect(tokens[0].raw).toBe("\\'");
      expect(tokens[1].type).toBe('ws');
      expect(tokens[1].raw).toBe(' ');
      expect(tokens[2].type).toBe('id');
      expect(tokens[2].raw).toBe('foo');
    });
    it('handles symbols ending in =? - #566', () => {
      // https://github.com/BetterThanTomorrow/calva/issues/566
      const tokens = scanner.processLine('foo=? foo');
      expect(tokens[0].type).toBe('id');
      expect(tokens[0].raw).toBe('foo=?');
      expect(tokens[1].type).toBe('ws');
      expect(tokens[1].raw).toBe(' ');
      expect(tokens[2].type).toBe('id');
      expect(tokens[2].raw).toBe('foo');
    });
    it('does not treat var quoted symbols as reader tags - #584', () => {
      // https://github.com/BetterThanTomorrow/calva/issues/584
      const tokens = scanner.processLine("#'foo");
      expect(tokens[0].type).toBe('id');
      expect(tokens[0].raw).toBe("#'foo");
    });
    it('does not croak on funny data in strings - #659', () => {
      // https://github.com/BetterThanTomorrow/calva/issues/659
      const tokens = scanner.processLine('" "'); // <- That's not a regular space
      expect(tokens[0].type).toBe('open');
      expect(tokens[0].raw).toBe('"');
      expect(tokens[1].type).toBe('junk');
      expect(tokens[1].raw).toBe(' ');
      expect(tokens[2].type).toBe('close');
      expect(tokens[2].raw).toBe('"');
    });
    it('does not hang on matching token rule regexes against a string of hashes', () => {
      // https://github.com/BetterThanTomorrow/calva/issues/667
      const text = '#################################################';
      const rule = toplevel.rules.find((rule) => rule.name === 'open');
      toplevel.rules.forEach((rule) => {
        console.log(`Testing rule: ${rule.name}`);
        const x = rule.r.exec(text);
        console.log(`Tested rule: ${rule.name}`);
        if (!['reader', 'junk'].includes(rule.name)) {
          expect(x).toBeNull();
        } else {
          expect(x.length).toBe(1);
        }
      });
    });
    it('does not croak on comments with hashes - #667', () => {
      // https://github.com/BetterThanTomorrow/calva/issues/659
      const text = ';; ################################################# FRONTEND';
      const tokens = scanner.processLine(text);
      expect(tokens.length).toBe(2);
      expect(tokens[0].type).toBe('comment');
      expect(tokens[0].raw === text);
    });
  });
});
