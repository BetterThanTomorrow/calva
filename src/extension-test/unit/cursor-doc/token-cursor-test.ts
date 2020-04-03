import { expect } from 'chai';
import { LispTokenCursor } from '../../../cursor-doc/token-cursor';
import * as mock from '../common/mock';

describe('Token Cursor', () => {
    const docText = '(a(b(c\n#f\n(#b \n[:f :b :z])\n#z\n1)))';
    let doc: mock.MockDocument;
    let scratchDoc: mock.MockDocument;

    beforeEach(() => {
        doc = new mock.MockDocument();
        doc.insertString(docText);

        scratchDoc = new mock.MockDocument();
    });

    describe('forwardSexp', () => {
        it('forwardSexp x4: (a(b(|c•#f•(#b •[:f :b :z])•#z•1))) => (a(b(c•#f•(#b •[:f :b :z])•#z•1|)))', () => {
            const cursor: LispTokenCursor = doc.getTokenCursor(5);
            cursor.forwardSexp();
            expect(cursor.offsetStart).equal(6);
            cursor.forwardSexp();
            expect(cursor.offsetStart).equal(26);
            cursor.forwardSexp();
            expect(cursor.offsetStart).equal(31);
            cursor.forwardSexp();
            expect(cursor.offsetStart).equal(31);
        });

        it('should skip over metadata if skipMetadata is true: (a| ^{:a 1} (= 1 1)) => (a ^{:a 1} (= 1 1)|)', () => {
            scratchDoc.insertString('(a ^{:a 1} (= 1 1))');
            const cursor = scratchDoc.getTokenCursor(2);
            cursor.forwardSexp(true, true);
            expect(cursor.offsetStart).equal(18);
        });

        it('should skip over multiple metadata maps if skipMetadata is true: (a| ^{:a 1} ^{:b 2} (= 1 1)) => (a ^{:a 1} ^{:b 2} (= 1 1)|)', () => {
            scratchDoc.insertString('(a ^{:a 1} ^{:b 2} (= 1 1)|');
            const cursor = scratchDoc.getTokenCursor(2);
            cursor.forwardSexp(true, true);
            expect(cursor.offsetStart).equal(26);
        });

        it('should skip over symbol shorthand for metadata if skipMetadata is true: (a| ^String (= 1 1)) => (a ^String (= 1 1)|)', () => {
            scratchDoc.insertString('(a ^String (= 1 1))');
            const cursor = scratchDoc.getTokenCursor(2);
            cursor.forwardSexp(true, true);
            expect(cursor.offsetStart).equal(18);
        });

        it('should skip over keyword shorthand for metadata if skipMetadata is true: (a| ^:hello (= 1 1)) => (a ^:hello (= 1 1)|)', () => {
            scratchDoc.insertString('(a ^:hello (= 1 1))');
            const cursor = scratchDoc.getTokenCursor(2);
            cursor.forwardSexp(true, true);
            expect(cursor.offsetStart).equal(18);
        });

        it('should skip over multiple keyword shorthands for metadata if skipMetadata is true: (a| ^:hello ^:world (= 1 1)) => (a ^:hello ^:world (= 1 1)|)', () => {
            scratchDoc.insertString('(a ^:hello ^:world (= 1 1))');
            const cursor = scratchDoc.getTokenCursor(2);
            cursor.forwardSexp(true, true);
            expect(cursor.offsetStart).equal(26);
        });

        it('should skip ignored forms if skipIgnoredForms is true: (a| #_1 #_2 3) => (a #_1 #_2 3|)', () => {
            scratchDoc.insertString('(a #_1 #_2 3)');
            const cursor = scratchDoc.getTokenCursor(2);
            cursor.forwardSexp(true, true, true);
            expect(cursor.offsetStart).equal(12);
        });

        it('should skip stacked ignored forms if skipIgnoredForms is true: (a| #_ #_ 1 2 3) => (a #_ #_ 1 2 3|)', () => {
            scratchDoc.insertString('(a #_ #_ 1 2 3)');
            const cursor = scratchDoc.getTokenCursor(2);
            cursor.forwardSexp(true, true, true);
            expect(cursor.offsetStart).equal(14);
        });
    });

    describe('downList', () => {

        it('should put cursor to the right of the following open paren: (a |(b 1) => (a (|b 1)', () => {
            scratchDoc.insertString('(a (b 1))');
            const cursor = scratchDoc.getTokenCursor(3);
            cursor.downList();
            expect(cursor.offsetStart).equal(4);
        });

        it('should put cursor to the right of the following open curly brace: (a |{:b 1})) => (a {|:b 1}))', () => {
            scratchDoc.insertString('(a {:b 1}))');
            const cursor = scratchDoc.getTokenCursor(3);
            cursor.downList();
            expect(cursor.offsetStart).equal(4);
        });

        it('should put cursor to the right of the following open bracket: (a |[1 2])) => (a [|1 2]))', () => {
            scratchDoc.insertString('(a [1 2]))');
            const cursor = scratchDoc.getTokenCursor(3);
            cursor.downList();
            expect(cursor.offsetStart).equal(4);
        });

        it(`should put cursor to the right of the following open paren that starts a list literal: (a |'(1 2)) => (a '(|1 2))`, () => {
            scratchDoc.insertString(`(a '(1 2))`);
            const cursor = scratchDoc.getTokenCursor(3);
            cursor.downList();
            expect(cursor.offsetStart).equal(5);
        });

        it('should skip whitespace: (a| (b 1)) => (a (|b 1))', () => {
            scratchDoc.insertString('(a (b 1))');
            const cursor = scratchDoc.getTokenCursor(2);
            cursor.downList();
            expect(cursor.offsetStart).equal(4);
        });

        it('should skip metadata when skipMetadata is true: (a |^{:x 1} (b 1)) => (a ^{:x 1} (|b 1))', () => {
            scratchDoc.insertString('(a ^{:x 1} (b 1))');
            const cursor = scratchDoc.getTokenCursor(3);
            cursor.downList(true);
            expect(cursor.offsetStart).equal(12);
        });
    });

    it('backwardSexp x4: (a(b(c•#f•(#b •[:f :b :z])•#z•1|))) => (a(b(|c•#f•(#b •[:f :b :z])•#z•1)))', () => {
        const cursor: LispTokenCursor = doc.getTokenCursor(31);
        cursor.backwardSexp();
        expect(cursor.offsetStart).equal(27);
        cursor.backwardSexp();
        expect(cursor.offsetStart).equal(7);
        cursor.backwardSexp();
        expect(cursor.offsetStart).equal(5);
        cursor.backwardSexp();
        expect(cursor.offsetStart).equal(5);
    });
    it('forwardList: (a(b(c•#|f•(#b •[:f :b :z])•#z•1))) => (a(b(c•#f•(#b •[:f :b :z])•#z•1|)))', () => {
        const cursor: LispTokenCursor = doc.getTokenCursor(8);
        cursor.forwardList();
        expect(cursor.offsetStart).equal(31);
    });
    it('upList: (a(b(c•#f•(#b •[:f :b :z])•#z•1|))) => (a(b(c•#f•(#b •[:f :b :z])•#z•1)|))', () => {
        const cursor: LispTokenCursor = doc.getTokenCursor(31);
        cursor.upList();
        expect(cursor.offsetStart).equal(32);
    });
    it('backwardList: (a(b(c•#f•(#b •[:f :b :z])•#z•|1))) => (a(b(|c•#f•(#b •[:f :b :z])•#z•1)))', () => {
        const cursor: LispTokenCursor = doc.getTokenCursor(30);
        cursor.backwardList();
        expect(cursor.offsetStart).equal(5);
    });

    it('backwardUpList: (a(b(c•#f•(#b •|[:f :b :z])•#z•1))) => (a(b(c•|#f•(#b •[:f :b :z])•#z•1)))', () => {
        const cursor: LispTokenCursor = doc.getTokenCursor(15);
        cursor.backwardUpList();
        expect(cursor.offsetStart).equal(7);
    });

    // TODO: Figure out why adding these tests make other test break!
    describe('Navigation in and around strings', () => {
        it('backwardList moves to start of string', () => {
            const doc = new mock.MockDocument();
            doc.insertString('(str [] "", "foo" "f   b  b"   "   f b b   " "\\"" \\")');
            const cursor: LispTokenCursor = doc.getTokenCursor(21);
            cursor.backwardList();
            expect(cursor.offsetStart).equal(19);
        });
        it('forwardList moves to end of string', () => {
            const doc = new mock.MockDocument();
            doc.insertString('(str [] "", "foo" "f   b  b"   "   f b b   " "\\"" \\")');
            const cursor: LispTokenCursor = doc.getTokenCursor(21);
            cursor.forwardList();
            expect(cursor.offsetStart).equal(27);
        });
        it('backwardSexpr inside string moves past quoted characters', () => {
            const doc = new mock.MockDocument();
            doc.insertString('(str [] "foo \\" bar")');
            const cursor: LispTokenCursor = doc.getTokenCursor(15);
            cursor.backwardSexp();
            expect(cursor.offsetStart).equal(13);
        });
    })

    describe('Current Form', () => {
        const docText = '(aaa (bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)))'.replace(/•/g, '\n'),
            doc: mock.MockDocument = new mock.MockDocument();

        beforeEach(() => {
            doc.insertString(docText);
        });

        it('0: selects from within non-list form', () => {
            const cursor: LispTokenCursor = doc.getTokenCursor(1);
            expect(cursor.rangeForCurrentForm(2)).deep.equal([1, 4]);
        });
        it('1: selects from adjanent after form', () => {
            const cursor: LispTokenCursor = doc.getTokenCursor(54);
            expect(cursor.rangeForCurrentForm(49)).deep.equal([46, 54]);
        });
        it('1: selects from adjanent after form, including readers', () => {
            const cursor: LispTokenCursor = doc.getTokenCursor(43);
            expect(cursor.rangeForCurrentForm(43)).deep.equal([22, 43]);
        });
        it('2: selects from adjanent before form', () => {
            const cursor: LispTokenCursor = doc.getTokenCursor(46);
            expect(cursor.rangeForCurrentForm(46)).deep.equal([46, 54]);
        });
        it('2: selects from adjanent before form, including readers', () => {
            const cursor: LispTokenCursor = doc.getTokenCursor(22);
            expect(cursor.rangeForCurrentForm(22)).deep.equal([22, 43]);
        });
        it('2: selects from adjanent before form, or in readers', () => {
            const cursor: LispTokenCursor = doc.getTokenCursor(21);
            expect(cursor.rangeForCurrentForm(21)).deep.equal([16, 55]);
        });
        it('2: selects from adjanent before a form tagged with readers', () => {
            const cursor: LispTokenCursor = doc.getTokenCursor(27);
            expect(cursor.rangeForCurrentForm(22)).deep.equal([22, 43]);
        });
        it('3: selects previous form, if on the same line', () => {
            const cursor: LispTokenCursor = doc.getTokenCursor(76);
            expect(cursor.rangeForCurrentForm(76)).deep.equal([72, 73]);
        });
        it('4: selects next form, if on the same line', () => {
            const cursor: LispTokenCursor = doc.getTokenCursor(65);
            expect(cursor.rangeForCurrentForm(65)).deep.equal([68, 69]);
        });
        it('5: selects previous form, if any', () => {
            const cursor: LispTokenCursor = doc.getTokenCursor(84);
            expect(cursor.rangeForCurrentForm(84)).deep.equal([77, 80]);
        });
        it('6: selects next form, if any', () => {
            const doc: mock.MockDocument = new mock.MockDocument();
            doc.insertString('  •  (foo {:a b})•(c)'.replace(/•/g, '\n'));
            const cursor: LispTokenCursor = doc.getTokenCursor(1);
            expect(cursor.rangeForCurrentForm(1)).deep.equal([5, 17]);
        });
        it('7: selects enclosing form, if any', () => {
            const doc: mock.MockDocument = new mock.MockDocument();
            doc.insertString('()  •  (foo {:a b})•(c)'.replace(/•/g, '\n'));
            const cursor: LispTokenCursor = doc.getTokenCursor(1);
            expect(cursor.rangeForCurrentForm(1)).deep.equal([0, 2]);
        });
    });
    describe('Location State', () => {
        it('Knows when inside string', () => {
            const doc = new mock.MockDocument();
            doc.insertString('(str [] "", "foo" "f   b  b"   "   f b b   " "\\"" \\")');
            const withinEmpty = doc.getTokenCursor(9);
            expect(withinEmpty.withinString()).equal(true);
            const adjacentOutsideLeft = doc.getTokenCursor(8);
            expect(adjacentOutsideLeft.withinString()).equal(false);
            const adjacentOutsideRight = doc.getTokenCursor(10);
            expect(adjacentOutsideRight.withinString()).equal(false);
            const noStringWS = doc.getTokenCursor(11);
            expect(noStringWS.withinString()).equal(false);
            const leftOfFirstWord = doc.getTokenCursor(13);
            expect(leftOfFirstWord.withinString()).equal(true);
            const rightOfLastWord = doc.getTokenCursor(16);
            expect(rightOfLastWord.withinString()).equal(true);
            const inWord = doc.getTokenCursor(14);
            expect(inWord.withinString()).equal(true);
            const spaceBetweenWords = doc.getTokenCursor(21);
            expect(spaceBetweenWords.withinString()).equal(true);
            const spaceBeforeFirstWord = doc.getTokenCursor(33);
            expect(spaceBeforeFirstWord.withinString()).equal(true);
            const spaceAfterLastWord = doc.getTokenCursor(41);
            expect(spaceAfterLastWord.withinString()).equal(true);
            const beforeQuotedStringQuote = doc.getTokenCursor(46);
            expect(beforeQuotedStringQuote.withinString()).equal(true);
            const inQuotedStringQuote = doc.getTokenCursor(47);
            expect(inQuotedStringQuote.withinString()).equal(true);
            const afterQuotedStringQuote = doc.getTokenCursor(48);
            expect(afterQuotedStringQuote.withinString()).equal(true);
            const beforeLiteralQuote = doc.getTokenCursor(50);
            expect(beforeLiteralQuote.withinString()).equal(false);
            const inLiteralQuote = doc.getTokenCursor(51);
            expect(inLiteralQuote.withinString()).equal(false);
            const afterLiteralQuote = doc.getTokenCursor(52);
            expect(afterLiteralQuote.withinString()).equal(false);
        });
    });
});
