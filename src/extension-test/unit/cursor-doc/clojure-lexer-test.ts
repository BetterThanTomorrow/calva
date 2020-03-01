import { expect } from 'chai';
import { Scanner } from '../../../cursor-doc/clojure-lexer';

const MAX_LINE_LENGTH = 100;

describe('Scanner', () => {
    let scanner: Scanner;

    beforeEach(() => {
        scanner = new Scanner(MAX_LINE_LENGTH);
    });

    describe('simple', () => {
        it('tokenizes symbol', () => {
            const tokens = scanner.processLine('foo');
            expect(tokens[0].type).equals('id');
            expect(tokens[0].raw).equals('foo');
        });
        it('tokenizes whitespace', () => {
            const tokens = scanner.processLine('foo   bar');
            expect(tokens[1].type).equals('ws');
            expect(tokens[1].raw).equals('   ');
        });
        it('tokenizes keyword', () => {
            const tokens = scanner.processLine(':foo');
            expect(tokens[0].type).equals('kw');
            expect(tokens[0].raw).equals(':foo');
        });
        it('tokenizes literal character', () => {
            const tokens = scanner.processLine('\\a');
            expect(tokens[0].type).equals('lit');
            expect(tokens[0].raw).equals('\\a');
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
    });
    describe('max line length', () => {
        it('too long lines', () => {
            const longLine = "foo ".repeat(26),
                tokens = scanner.processLine(longLine);
            expect(tokens[0].type).equals('too-long-line');
            expect(tokens[0].raw).equals(longLine);
        });
    });
    describe('issues', () => {
        it('literal quotes - #566', () => {
            const tokens = scanner.processLine("\\' foo");
            expect(tokens[0].type).equals('lit');
            expect(tokens[0].raw).equals("\\'");
            expect(tokens[1].type).equals('ws');
            expect(tokens[1].raw).equals(" ");
            expect(tokens[2].type).equals('id');
            expect(tokens[2].raw).equals("foo");
        });
        it('symbols ending in =? - #566', () => {
            const tokens = scanner.processLine("foo=? foo");
            expect(tokens[0].type).equals('id');
            expect(tokens[0].raw).equals("foo=?");
            expect(tokens[1].type).equals('ws');
            expect(tokens[1].raw).equals(" ");
            expect(tokens[2].type).equals('id');
            expect(tokens[2].raw).equals("foo");
        });
    });
});


