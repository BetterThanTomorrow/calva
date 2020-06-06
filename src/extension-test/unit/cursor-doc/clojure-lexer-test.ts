import { expect } from 'chai';
import * as fc from 'fast-check';
import { Scanner } from '../../../cursor-doc/clojure-lexer';

const MAX_LINE_LENGTH = 100;

// fast-check Arbritraries

// TODO: single quotes are valid in real Clojure, but Calva can't handle them in symbols yet
const wsChars = [',', ' ', '\t', '\n', '\r'],
    openChars = ['"', '(', '[', '{'],
    closeChars = ['"', ')', ']', '}'],
    nonSymbolChars = [...wsChars, ...[';', '@', '~', '`'], ...openChars, ...closeChars];

function symbolChar(): fc.Arbitrary<string> {
    // We need to filter away all kinds of whitespace, therefore the regex...
    return fc.unicode().filter(c => !(nonSymbolChars.includes(c) || c.match(/\s/)));
}

function symbolStart(): fc.Arbitrary<string> {
    return fc.tuple(symbolChar(), symbolChar(), symbolChar())
        .map(([c1, c2, c3]) => `${c1}${c2}${c3}`)
        .filter(s => !!s.match(/^(?:[^#:]|#'[^'])/));
}

function symbol(): fc.Arbitrary<string> {
    return fc.tuple(symbolStart(), fc.stringOf(symbolChar(), 1, 5)).map(([c, s]) => `${c}${s}`);
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



describe('Scanner', () => {
    let scanner: Scanner;

    beforeEach(() => {
        scanner = new Scanner(MAX_LINE_LENGTH);
    });

    describe('simple', () => {
        it('tokenizes symbol', () => {
            fc.assert(
                fc.property(symbol(), data => {
                    const tokens = scanner.processLine(data);
                    expect(tokens[0].type).equal('id');
                    expect(tokens[0].raw).equal(data);
                })
            )
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
        it('tokenizes ignores', () => {
            const tokens = scanner.processLine('#_foo');
            expect(tokens[0].type).equals('ignore');
            expect(tokens[0].raw).equals('#_');
            expect(tokens[1].type).equals('id');
            expect(tokens[1].raw).equals('foo');
        });
        it('tokenizes opens', () => {
            fc.assert(
                fc.property(keyword(), data => {
                    const tokens = scanner.processLine(data);
                    expect(tokens[0].type).equal('kw');
                    expect(tokens[0].raw).equal(data);
                })
            )
        });
    });
    describe('lists', () => {
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
        it('tokenizes tagged kws', () => {
            const tokens = scanner.processLine('#foo :bar');
            expect(tokens[0].type).equals('kw');
            expect(tokens[0].raw).equals('#foo :bar');
        });
        it('tokenizes tagged opens', () => {
            const tokens = scanner.processLine('#foo (foo)');
            expect(tokens[0].type).equals('open');
            expect(tokens[0].raw).equals('#foo (');
            expect(tokens[1].type).equals('id');
            expect(tokens[1].raw).equals('foo');
            expect(tokens[2].type).equals('close');
            expect(tokens[2].raw).equals(')');
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
    });
});