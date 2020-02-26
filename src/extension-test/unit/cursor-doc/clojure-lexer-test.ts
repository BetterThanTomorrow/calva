import { expect } from 'chai';
import { Scanner } from '../../../cursor-doc/clojure-lexer';

describe('Scanner', () => {
    let scanner: Scanner;

    beforeEach(() => {
        scanner = new Scanner(100);
    });

    describe('tokenize', () => {
        it('symbol', () => {
            const tokens = scanner.processLine('foo');
            expect(tokens[0].type).equals('id');
            expect(tokens[0].raw).equals('foo');
        });
        it('keyword', () => {
            const tokens = scanner.processLine(':foo');
            expect(tokens[0].type).equals('kw');
            expect(tokens[0].raw).equals(':foo');
        });
        it('string', () => {
            const tokens = scanner.processLine('"foo"').slice(0,3);
            expect(tokens.map(t => { return [t.type, t.raw] })).deep.equals([['open', '"'], ['str-inside', 'foo'], ['close', '"']]);
        });
    });
});


