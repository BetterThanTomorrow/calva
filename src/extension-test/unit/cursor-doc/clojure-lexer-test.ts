import { expect } from 'chai';
import * as fc from 'fast-check';
import { Scanner } from '../../../cursor-doc/clojure-lexer';
import { toplevel, validPair } from '../../../cursor-doc/clojure-lexer'

const MAX_LINE_LENGTH = 100;

// fast-check Arbritraries

// TODO: single quotes are valid in real Clojure, but Calva can't handle them in symbols yet
const wsChars = [',', ' ', '\t', '\n', '\r'];
const openChars = ['"', '(', '[', '{'];
const closeChars = ['"', ')', ']', '}'];
const formPrefixChars = ["'", '@', '~', '`', '^', ','];
const nonSymbolChars = [...wsChars, ...[';', '@', '~', '`'], ...openChars, ...closeChars];

function symbolChar(): fc.Arbitrary<string> {
    // We need to filter away all kinds of whitespace, therefore the regex...
    return fc.unicode().filter(c => !(nonSymbolChars.includes(c) || c.match(/\s/)));
}

function formPrefixChar(): fc.Arbitrary<string> {
    return fc.constantFrom(...formPrefixChars);
}

function open(): fc.Arbitrary<string> {
    return fc.tuple(fc.stringOf(formPrefixChar(), 0, 3), fc.stringOf(fc.constantFrom(...[' ', '\t']), 0, 2), fc.constantFrom(...openChars)).map(([p, ws, o]) => `${p}${ws}${o}`);
}

function close(): fc.Arbitrary<string> {
    return fc.constantFrom(...closeChars);
}

function symbolStartIncludingDigit(): fc.Arbitrary<string> {
    return fc.tuple(symbolChar(), symbolChar(), symbolChar())
        .map(([c1, c2, c3]) => `${c1}${c2}${c3}`)
        .filter(s => !!s.match(/^(?:[^#:]|#'[^'])/));
}

function symbolStart(): fc.Arbitrary<string> {
    return symbolStartIncludingDigit().filter(s => !s.match(/^\d/));
}

function symbol(): fc.Arbitrary<string> {
    return fc.tuple(symbolStart(), fc.stringOf(symbolChar(), 1, 5)).map(([c, s]) => `${c}${s}`);
}

function underscoreSymbol(): fc.Arbitrary<string> {
    return fc.tuple(fc.constant('_'), symbolStartIncludingDigit(), fc.stringOf(symbolChar(), 1, 5)).map(([c, s]) => `${c}${s}`);
}

function keyword(): fc.Arbitrary<string> {
    return fc.tuple(fc.constantFrom(":"), symbol()).map(([c, s]) => `${c}${s}`);
}

function wsChar(): fc.Arbitrary<string> {
    return fc.constantFrom(...wsChars);
}

function ws(): fc.Arbitrary<string> {
    return fc.stringOf(wsChar(), 1, 3);
}

function nonWsChar(): fc.Arbitrary<string> {
    return fc.unicode().filter(c => !(wsChars.includes(c) || c.match(/\s/)));
}

function nonWs(): fc.Arbitrary<string> {
    return fc.stringOf(nonWsChar(), 1, 3);
}

function quotedLiteralChar(): fc.Arbitrary<string> {
    return fc.unicode().filter(c => !([...wsChars, ...openChars, ...closeChars].includes(c) || c.match(/\s/)));
}

function quotedLiteral(): fc.Arbitrary<string> {
    return fc.tuple(fc.constantFrom('\\'), quotedLiteralChar()).map(([c, s]) => `${c}${s}`);
}

function list(): fc.Arbitrary<string> {
    return fc.tuple(open(), symbol(), close())
        .filter(([o, _s, c]) => { return validPair(o[o.length - 1], c) })
        .map(([o, s, c]) => `${o}${s}${c}`);
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
                    fc.property(symbol(), data => {
                        const tokens = scanner.processLine(data);
                        expect(tokens[0].type).equal('id');
                        expect(tokens[0].raw).equal(data);
                    })
                )
            });
            it('tokenizes symbols starting with _', () => {
                fc.assert(
                    fc.property(underscoreSymbol(), data => {
                        const tokens = scanner.processLine(data);
                        expect(tokens[0].type).equal('id');
                        expect(tokens[0].raw).equal(data);
                    })
                )
            });
            it('tokenizes _ as a symbol', () => {
                const tokens = scanner.processLine('_');
                expect(tokens[0].type).equals('id');
                expect(tokens[0].raw).equals('_');
            });
        });
        it('tokenizes whitespace', () => {
            fc.assert(
                fc.property(ws(), data => {
                    // Remove extra eol put in there by the scanner
                    const tokens = scanner.processLine(data).slice(0, -1);
                    expect(tokens.map(t => t.raw).join("")).equal(data);
                    tokens.forEach(t => {
                        expect(t.type).equal('ws');
                    });
                })
            )
            const tokens = scanner.processLine('foo   bar');
            expect(tokens[1].type).equals('ws');
            expect(tokens[1].raw).equals('   ');
        });
        it('tokenizes keyword', () => {
            fc.assert(
                fc.property(keyword(), data => {
                    const tokens = scanner.processLine(data);
                    expect(tokens[0].type).equal('kw');
                    expect(tokens[0].raw).equal(data);
                })
            )
        });
        it('tokenizes literal character', () => {
            fc.assert(
                fc.property(quotedLiteral(), data => {
                    const tokens = scanner.processLine(data);
                    expect(tokens[0].type).equal('lit');
                    expect(tokens[0].raw).equal(data);
                })
            )
        });
        it('tokenizes literal named character', () => {
            const tokens = scanner.processLine('\\space');
            expect(tokens[0].type).equals('lit');
            expect(tokens[0].raw).equals('\\space');
        });
        it('tokenizes line comments', () => {
            const tokens = scanner.processLine('; foo');
            expect(tokens[0].type).equals('comment');
            expect(tokens[0].raw).equals('; foo');
        });
        describe('tokenizes ignores', () => {
            it('sole, no ws', () => {
                const tokens = scanner.processLine('#_foo');
                expect(tokens[0].type).equals('ignore');
                expect(tokens[0].raw).equals('#_');
                expect(tokens[1].type).equals('id');
                expect(tokens[1].raw).equals('foo');
            });
            it('sole, trailing ws', () => {
                const tokens = scanner.processLine('#_ foo');
                expect(tokens[0].type).equals('ignore');
                expect(tokens[0].raw).equals('#_');
                expect(tokens[1].type).equals('ws');
                expect(tokens[1].raw).equals(' ');
                expect(tokens[2].type).equals('id');
                expect(tokens[2].raw).equals('foo');
            });
            it('sole, leading symbol/id, no ws', () => {
                const tokens = scanner.processLine('foo#_bar');
                expect(tokens[0].type).equals('id');
                expect(tokens[0].raw).equals('foo#_bar');
            });
            it('sole, leading number, no ws', () => {
                const tokens = scanner.processLine('1.2#_foo');
                expect(tokens[0].type).equals('lit');
                expect(tokens[0].raw).equals('1.2');
                expect(tokens[1].type).equals('ignore');
                expect(tokens[1].raw).equals('#_');
                expect(tokens[2].type).equals('id');
                expect(tokens[2].raw).equals('foo');
            });
            it('many, no ws', () => {
                const tokens = scanner.processLine('#_#_#_foo');
                expect(tokens[0].type).equals('ignore');
                expect(tokens[0].raw).equals('#_');
                expect(tokens[1].type).equals('ignore');
                expect(tokens[1].raw).equals('#_');
                expect(tokens[2].type).equals('ignore');
                expect(tokens[2].raw).equals('#_');
                expect(tokens[3].type).equals('id');
                expect(tokens[3].raw).equals('foo');
            });
        });
        it('tokenizes the Calva repl prompt', () => {
            const tokens = scanner.processLine('foo::bar.baz=> ()');
            expect(tokens[0].type).equals('prompt');
            expect(tokens[0].raw).equals('foo::bar.baz=> ');
            expect(tokens[1].type).equals('open');
            expect(tokens[1].raw).equals('(');
            expect(tokens[2].type).equals('close');
            expect(tokens[2].raw).equals(')');
        });
        it('only tokenizes the Calva repl prompt if it is at the start of a line', () => {
            const tokens = scanner.processLine(' foo::bar.baz=> ()');
            expect(tokens[0].type).equals('ws');
            expect(tokens[0].raw).equals(' ');
            expect(tokens[1].type).equals('id');
            expect(tokens[1].raw).equals('foo::bar.baz=>');
            expect(tokens[2].type).equals('ws');
            expect(tokens[2].raw).equals(' ');
            expect(tokens[3].type).equals('open');
            expect(tokens[3].raw).equals('(');
            expect(tokens[4].type).equals('close');
            expect(tokens[4].raw).equals(')');
        });
        it('only tokenizes the Calva repl prompt if it ends with a space', () => {
            const tokens = scanner.processLine('foo::bar.baz=>()');
            expect(tokens[0].type).equals('id');
            expect(tokens[0].raw).equals('foo::bar.baz=>');
            expect(tokens[1].type).equals('open');
            expect(tokens[1].raw).equals('(');
            expect(tokens[2].type).equals('close');
            expect(tokens[2].raw).equals(')');
        });
    });
    describe('lists', () => {
        it('tokenizes list/vector/map/string', () => {
            fc.assert(
                fc.property(list(), data => {
                    const tokens = scanner.processLine(data);
                    const numTokens = tokens.length;
                    expect(tokens[numTokens - 4].type).equal('open');
                    expect(tokens[numTokens - 2].type).equal('close');
                })
            );
        });
        it('tokenizes list', () => {
            const tokens = scanner.processLine('(foo)');
            expect(tokens[0].type).equals('open');
            expect(tokens[0].raw).equals('(');
            expect(tokens[1].type).equals('id');
            expect(tokens[1].raw).equals('foo');
            expect(tokens[2].type).equals('close');
            expect(tokens[2].raw).equals(')');
        });
        it('tokenizes vector', () => {
            const tokens = scanner.processLine('[foo]');
            expect(tokens[0].type).equals('open');
            expect(tokens[0].raw).equals('[');
            expect(tokens[1].type).equals('id');
            expect(tokens[1].raw).equals('foo');
            expect(tokens[2].type).equals('close');
            expect(tokens[2].raw).equals(']');
        });
        it('tokenizes map', () => {
            const tokens = scanner.processLine('{:foo bar}');
            expect(tokens[0].type).equals('open');
            expect(tokens[0].raw).equals('{');
            expect(tokens[1].type).equals('kw');
            expect(tokens[1].raw).equals(':foo');
            expect(tokens[2].type).equals('ws');
            expect(tokens[2].raw).equals(' ');
            expect(tokens[3].type).equals('id');
            expect(tokens[3].raw).equals('bar');
            expect(tokens[4].type).equals('close');
            expect(tokens[4].raw).equals('}');
        });
        it('tokenizes set', () => {
            const tokens = scanner.processLine('#{:foo :bar}');
            expect(tokens[0].type).equals('open');
            expect(tokens[0].raw).equals('#{');
            expect(tokens[1].type).equals('kw');
            expect(tokens[1].raw).equals(':foo');
            expect(tokens[2].type).equals('ws');
            expect(tokens[2].raw).equals(' ');
            expect(tokens[3].type).equals('kw');
            expect(tokens[3].raw).equals(':bar');
            expect(tokens[4].type).equals('close');
            expect(tokens[4].raw).equals('}');
        });
        it('tokenizes string', () => {
            const tokens = scanner.processLine('"foo"');
            expect(tokens[0].type).equals('open');
            expect(tokens[0].raw).equals('"');
            expect(tokens[1].type).equals('str-inside');
            expect(tokens[1].raw).equals('foo');
            expect(tokens[2].type).equals('close');
            expect(tokens[2].raw).equals('"');
        });
        it('tokenizes regex', () => {
            const tokens = scanner.processLine('#"foo"');
            expect(tokens[0].type).equals('open');
            expect(tokens[0].raw).equals('#"');
            expect(tokens[1].type).equals('str-inside');
            expect(tokens[1].raw).equals('foo');
            expect(tokens[2].type).equals('close');
            expect(tokens[2].raw).equals('"');
        });
    });
    describe('data reader tags', () => {
        it('tokenizes tag, separate line', () => {
            const tokens = scanner.processLine('#foo');
            expect(tokens[0].type).equals('reader');
            expect(tokens[0].raw).equals('#foo');
        });
        it('does not treat var quote plus open token as reader tag plus open token', () => {
            const tokens = scanner.processLine("#'foo []")
            expect(tokens[0].type).equals('id');
            expect(tokens[0].raw).equals("#'foo");
            expect(tokens[1].type).equals('ws');
            expect(tokens[1].raw).equals(' ');
            expect(tokens[2].type).equals('open');
            expect(tokens[2].raw).equals('[');
            expect(tokens[3].type).equals('close');
            expect(tokens[3].raw).equals(']');
        });
    });
    describe('strings', () => {
        it('tokenizes words in strings', () => {
            const tokens = scanner.processLine('"(foo :bar)"');
            expect(tokens[0].type).equals('open');
            expect(tokens[0].raw).equals('"');
            expect(tokens[1].type).equals('str-inside');
            expect(tokens[1].raw).equals('(foo');
            expect(tokens[2].type).equals('ws');
            expect(tokens[2].raw).equals(' ');
            expect(tokens[3].type).equals('str-inside');
            expect(tokens[3].raw).equals(':bar)');
            expect(tokens[4].type).equals('close');
            expect(tokens[4].raw).equals('"');
        });
        it('tokenizes newlines in strings', () => {
            const tokens = scanner.processLine('"foo\nbar"');
            expect(tokens[0].type).equals('open');
            expect(tokens[0].raw).equals('"');
            expect(tokens[1].type).equals('str-inside');
            expect(tokens[1].raw).equals('foo');
            expect(tokens[2].type).equals('ws');
            expect(tokens[2].raw).equals('\n');
            expect(tokens[3].type).equals('str-inside');
            expect(tokens[3].raw).equals('bar');
            expect(tokens[4].type).equals('close');
            expect(tokens[4].raw).equals('"');
        });
        it('tokenizes quoted quotes in strings', () => {
            let tokens = scanner.processLine('"\\""');
            expect(tokens[0].type).equals('open');
            expect(tokens[0].raw).equals('"');
            expect(tokens[1].type).equals('str-inside');
            expect(tokens[1].raw).equals('\\"');
            tokens = scanner.processLine('"foo\\"bar"');
            expect(tokens[1].type).equals('str-inside');
            expect(tokens[1].raw).equals('foo\\"bar');
        });
    });
    describe('Reported issues', () => {
        it('too long lines - #566', () => {
            // https://github.com/BetterThanTomorrow/calva/issues/556
            const longLine = "foo ".repeat(26),
                tokens = scanner.processLine(longLine);
            expect(tokens[0].type).equals('too-long-line');
            expect(tokens[0].raw).equals(longLine);
        });
        it('handles literal quotes - #566', () => {
            // https://github.com/BetterThanTomorrow/calva/issues/566
            const tokens = scanner.processLine("\\' foo");
            expect(tokens[0].type).equals('lit');
            expect(tokens[0].raw).equals("\\'");
            expect(tokens[1].type).equals('ws');
            expect(tokens[1].raw).equals(" ");
            expect(tokens[2].type).equals('id');
            expect(tokens[2].raw).equals("foo");
        });
        it('handles symbols ending in =? - #566', () => {
            // https://github.com/BetterThanTomorrow/calva/issues/566
            const tokens = scanner.processLine("foo=? foo");
            expect(tokens[0].type).equals('id');
            expect(tokens[0].raw).equals("foo=?");
            expect(tokens[1].type).equals('ws');
            expect(tokens[1].raw).equals(" ");
            expect(tokens[2].type).equals('id');
            expect(tokens[2].raw).equals("foo");
        });
        it('does not treat var quoted symbols as reader tags - #584', () => {
            // https://github.com/BetterThanTomorrow/calva/issues/584
            const tokens = scanner.processLine("#'foo");
            expect(tokens[0].type).equals('id');
            expect(tokens[0].raw).equals("#'foo");
        });
        it('does not croak on funny data in strings - #659', () => {
            // https://github.com/BetterThanTomorrow/calva/issues/659
            const tokens = scanner.processLine('" "'); // <- That's not a regular space
            expect(tokens[0].type).equals('open');
            expect(tokens[0].raw).equals('"');
            expect(tokens[1].type).equals('junk');
            expect(tokens[1].raw).equals(' ');
            expect(tokens[2].type).equals('close');
            expect(tokens[2].raw).equals('"');
        });
        it('does not hang on matching token rule regexes against a string of hashes', () => {
            // https://github.com/BetterThanTomorrow/calva/issues/667
            const text = '#################################################';
            const rule = toplevel.rules.find(rule => rule.name === "open");
            toplevel.rules.forEach(rule => {
                console.log(`Testing rule: ${rule.name}`)
                const x = rule.r.exec(text);
                console.log(`Tested rule: ${rule.name}`)
                if (!['reader', 'junk'].includes(rule.name)) {
                    expect(x).null;
                } else {
                    expect(x.length).equals(1);
                }
            });
        });
        xit('does not croak on comments with hashes - #667', () => {
            // https://github.com/BetterThanTomorrow/calva/issues/659
            const text = ';; ################################################# FRONTEND';
            const tokens = scanner.processLine(text);
            expect(tokens.length).equals(1);
            expect(tokens[0].type).equals('comment');
            expect(tokens[0].raw === text);
        });
    });
});