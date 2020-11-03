import * as expect from 'expect';
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
            expect(cursor.offsetStart).toBe(6);
            cursor.forwardSexp();
            expect(cursor.offsetStart).toBe(26);
            cursor.forwardSexp();
            expect(cursor.offsetStart).toBe(31);
            cursor.forwardSexp();
            expect(cursor.offsetStart).toBe(31);
        });

        it('should skip over metadata if skipMetadata is true: (a| ^{:a 1} (= 1 1)) => (a ^{:a 1} (= 1 1)|)', () => {
            scratchDoc.insertString('(a ^{:a 1} (= 1 1))');
            const cursor = scratchDoc.getTokenCursor(2);
            cursor.forwardSexp(true, true);
            expect(cursor.offsetStart).toBe(18);
        });

        it('should skip over multiple metadata maps if skipMetadata is true: (a| ^{:a 1} ^{:b 2} (= 1 1)) => (a ^{:a 1} ^{:b 2} (= 1 1)|)', () => {
            scratchDoc.insertString('(a ^{:a 1} ^{:b 2} (= 1 1)|');
            const cursor = scratchDoc.getTokenCursor(2);
            cursor.forwardSexp(true, true);
            expect(cursor.offsetStart).toBe(26);
        });

        it('should skip over symbol shorthand for metadata if skipMetadata is true: (a| ^String (= 1 1)) => (a ^String (= 1 1)|)', () => {
            scratchDoc.insertString('(a ^String (= 1 1))');
            const cursor = scratchDoc.getTokenCursor(2);
            cursor.forwardSexp(true, true);
            expect(cursor.offsetStart).toBe(18);
        });

        it('should skip over keyword shorthand for metadata if skipMetadata is true: (a| ^:hello (= 1 1)) => (a ^:hello (= 1 1)|)', () => {
            scratchDoc.insertString('(a ^:hello (= 1 1))');
            const cursor = scratchDoc.getTokenCursor(2);
            cursor.forwardSexp(true, true);
            expect(cursor.offsetStart).toBe(18);
        });

        it('should skip over multiple keyword shorthands for metadata if skipMetadata is true: (a| ^:hello ^:world (= 1 1)) => (a ^:hello ^:world (= 1 1)|)', () => {
            scratchDoc.insertString('(a ^:hello ^:world (= 1 1))');
            const cursor = scratchDoc.getTokenCursor(2);
            cursor.forwardSexp(true, true);
            expect(cursor.offsetStart).toBe(26);
        });

        it('should skip ignored forms if skipIgnoredForms is true: (a| #_1 #_2 3) => (a #_1 #_2 3|)', () => {
            scratchDoc.insertString('(a #_1 #_2 3)');
            const cursor = scratchDoc.getTokenCursor(2);
            cursor.forwardSexp(true, true, true);
            expect(cursor.offsetStart).toBe(12);
        });

        it('should skip stacked ignored forms if skipIgnoredForms is true: (a| #_ #_ 1 2 3) => (a #_ #_ 1 2 3|)', () => {
            scratchDoc.insertString('(a #_ #_ 1 2 3)');
            const cursor = scratchDoc.getTokenCursor(2);
            cursor.forwardSexp(true, true, true);
            expect(cursor.offsetStart).toBe(14);
        });

    });

    describe('backardSexp', () => {
        it('backwardSexp x4: (a(b(c•#f•(#b •[:f :b :z])•#z•1|))) => (a(b(|c•#f•(#b •[:f :b :z])•#z•1)))', () => {
            const cursor: LispTokenCursor = doc.getTokenCursor(31);
            cursor.backwardSexp();
            expect(cursor.offsetStart).toBe(27);
            cursor.backwardSexp();
            expect(cursor.offsetStart).toBe(7);
            cursor.backwardSexp();
            expect(cursor.offsetStart).toBe(5);
            cursor.backwardSexp();
            expect(cursor.offsetStart).toBe(5);
        });

    });

    describe('downList', () => {

        it('should put cursor to the right of the following open paren: (a |(b 1) => (a (|b 1)', () => {
            scratchDoc.insertString('(a (b 1))');
            const cursor = scratchDoc.getTokenCursor(3);
            cursor.downList();
            expect(cursor.offsetStart).toBe(4);
        });

        it('should put cursor to the right of the following open curly brace: (a |{:b 1})) => (a {|:b 1}))', () => {
            scratchDoc.insertString('(a {:b 1}))');
            const cursor = scratchDoc.getTokenCursor(3);
            cursor.downList();
            expect(cursor.offsetStart).toBe(4);
        });

        it('should put cursor to the right of the following open bracket: (a |[1 2])) => (a [|1 2]))', () => {
            scratchDoc.insertString('(a [1 2]))');
            const cursor = scratchDoc.getTokenCursor(3);
            cursor.downList();
            expect(cursor.offsetStart).toBe(4);
        });

        it(`should put cursor to the right of the following open paren that starts a list literal: (a |'(1 2)) => (a '(|1 2))`, () => {
            scratchDoc.insertString(`(a '(1 2))`);
            const cursor = scratchDoc.getTokenCursor(3);
            cursor.downList();
            expect(cursor.offsetStart).toBe(5);
        });

        it('should skip whitespace: (a| (b 1)) => (a (|b 1))', () => {
            scratchDoc.insertString('(a (b 1))');
            const cursor = scratchDoc.getTokenCursor(2);
            cursor.downList();
            expect(cursor.offsetStart).toBe(4);
        });

        it('should skip metadata when skipMetadata is true: (a |^{:x 1} (b 1)) => (a ^{:x 1} (|b 1))', () => {
            scratchDoc.insertString('(a ^{:x 1} (b 1))');
            const cursor = scratchDoc.getTokenCursor(3);
            cursor.downList(true);
            expect(cursor.offsetStart).toBe(12);
        });
    });

    it('forwardList: (a(b(c•#|f•(#b •[:f :b :z])•#z•1))) => (a(b(c•#f•(#b •[:f :b :z])•#z•1|)))', () => {
        const cursor: LispTokenCursor = doc.getTokenCursor(8);
        cursor.forwardList();
        expect(cursor.offsetStart).toBe(31);
    });
    it('upList: (a(b(c•#f•(#b •[:f :b :z])•#z•1|))) => (a(b(c•#f•(#b •[:f :b :z])•#z•1)|))', () => {
        const cursor: LispTokenCursor = doc.getTokenCursor(31);
        cursor.upList();
        expect(cursor.offsetStart).toBe(32);
    });
    it('backwardList: (a(b(c•#f•(#b •[:f :b :z])•#z•|1))) => (a(b(|c•#f•(#b •[:f :b :z])•#z•1)))', () => {
        const cursor: LispTokenCursor = doc.getTokenCursor(30);
        cursor.backwardList();
        expect(cursor.offsetStart).toBe(5);
    });

    it('backwardUpList: (a(b(c•#f•(#b •|[:f :b :z])•#z•1))) => (a(b(c•|#f•(#b •[:f :b :z])•#z•1)))', () => {
        const cursor: LispTokenCursor = doc.getTokenCursor(15);
        cursor.backwardUpList();
        expect(cursor.offsetStart).toBe(7);
    });

    // TODO: Figure out why adding these tests make other test break!
    describe('Navigation in and around strings', () => {
        it('backwardList moves to start of string', () => {
            const doc = new mock.MockDocument();
            doc.insertString('(str [] "", "foo" "f   b  b"   "   f b b   " "\\"" \\")');
            const cursor: LispTokenCursor = doc.getTokenCursor(21);
            cursor.backwardList();
            expect(cursor.offsetStart).toBe(19);
        });
        it('forwardList moves to end of string', () => {
            const doc = new mock.MockDocument();
            doc.insertString('(str [] "", "foo" "f   b  b"   "   f b b   " "\\"" \\")');
            const cursor: LispTokenCursor = doc.getTokenCursor(21);
            cursor.forwardList();
            expect(cursor.offsetStart).toBe(27);
        });
        it('backwardSexpr inside string moves past quoted characters', () => {
            const doc = new mock.MockDocument();
            doc.insertString('(str [] "foo \\" bar")');
            const cursor: LispTokenCursor = doc.getTokenCursor(15);
            cursor.backwardSexp();
            expect(cursor.offsetStart).toBe(13);
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
            expect(cursor.rangeForCurrentForm(2)).toEqual([1, 4]);
        });
        it('1: selects from adjanent after form', () => {
            const cursor: LispTokenCursor = doc.getTokenCursor(54);
            expect(cursor.rangeForCurrentForm(49)).toEqual([46, 54]);
        });
        it('1: selects from adjanent after form, including readers', () => {
            const cursor: LispTokenCursor = doc.getTokenCursor(43);
            expect(cursor.rangeForCurrentForm(43)).toEqual([22, 43]);
        });
        it('2: selects from adjanent before form', () => {
            const cursor: LispTokenCursor = doc.getTokenCursor(46);
            expect(cursor.rangeForCurrentForm(46)).toEqual([46, 54]);
        });
        it('2: selects from adjanent before form, including readers', () => {
            const cursor: LispTokenCursor = doc.getTokenCursor(22);
            expect(cursor.rangeForCurrentForm(22)).toEqual([22, 43]);
        });
        it('2: selects from adjanent before form, or in readers', () => {
            const cursor: LispTokenCursor = doc.getTokenCursor(21);
            expect(cursor.rangeForCurrentForm(21)).toEqual([16, 55]);
        });
        it('2: selects from adjanent before a form tagged with readers', () => {
            const cursor: LispTokenCursor = doc.getTokenCursor(27);
            expect(cursor.rangeForCurrentForm(22)).toEqual([22, 43]);
        });
        it('3: selects previous form, if on the same line', () => {
            const cursor: LispTokenCursor = doc.getTokenCursor(76);
            expect(cursor.rangeForCurrentForm(76)).toEqual([72, 73]);
        });
        it('4: selects next form, if on the same line', () => {
            const cursor: LispTokenCursor = doc.getTokenCursor(65);
            expect(cursor.rangeForCurrentForm(65)).toEqual([68, 69]);
        });
        it('5: selects previous form, if any', () => {
            const cursor: LispTokenCursor = doc.getTokenCursor(84);
            expect(cursor.rangeForCurrentForm(84)).toEqual([77, 80]);
        });
        it('6: selects next form, if any', () => {
            const doc: mock.MockDocument = new mock.MockDocument();
            doc.insertString('  •  (foo {:a b})•(c)'.replace(/•/g, '\n'));
            const cursor: LispTokenCursor = doc.getTokenCursor(1);
            expect(cursor.rangeForCurrentForm(1)).toEqual([5, 17]);
        });
        it('7: selects enclosing form, if any', () => {
            const doc: mock.MockDocument = new mock.MockDocument();
            doc.insertString('()  •  (foo {:a b})•(c)'.replace(/•/g, '\n'));
            const cursor: LispTokenCursor = doc.getTokenCursor(1);
            expect(cursor.rangeForCurrentForm(1)).toEqual([0, 2]);
        });
        it('2: selects anonymous function when cursor is before #', () => {
            const doc = new mock.MockDocument();
            doc.insertString('(map #(println %) [1 2])');
            const cursor = doc.getTokenCursor(5);
            const range = cursor.rangeForCurrentForm(5);
            expect(range).toEqual([5, 17]);
        });
        it('2: selects anonymous function when cursor is after # and before (', () => {
            const doc = new mock.MockDocument();
            doc.insertString('(map #(println %) [1 2])');
            const cursor = doc.getTokenCursor(6);
            const range = cursor.rangeForCurrentForm(6);
            expect(range).toEqual([5, 17]);
        });
    });
    describe('Location State', () => {
        it('Knows when inside string', () => {
            const doc = new mock.MockDocument();
            doc.insertString('(str [] "", "foo" "f   b  b"   "   f b b   " "\\"" \\")');
            const withinEmpty = doc.getTokenCursor(9);
            expect(withinEmpty.withinString()).toBe(true);
            const adjacentOutsideLeft = doc.getTokenCursor(8);
            expect(adjacentOutsideLeft.withinString()).toBe(false);
            const adjacentOutsideRight = doc.getTokenCursor(10);
            expect(adjacentOutsideRight.withinString()).toBe(false);
            const noStringWS = doc.getTokenCursor(11);
            expect(noStringWS.withinString()).toBe(false);
            const leftOfFirstWord = doc.getTokenCursor(13);
            expect(leftOfFirstWord.withinString()).toBe(true);
            const rightOfLastWord = doc.getTokenCursor(16);
            expect(rightOfLastWord.withinString()).toBe(true);
            const inWord = doc.getTokenCursor(14);
            expect(inWord.withinString()).toBe(true);
            const spaceBetweenWords = doc.getTokenCursor(21);
            expect(spaceBetweenWords.withinString()).toBe(true);
            const spaceBeforeFirstWord = doc.getTokenCursor(33);
            expect(spaceBeforeFirstWord.withinString()).toBe(true);
            const spaceAfterLastWord = doc.getTokenCursor(41);
            expect(spaceAfterLastWord.withinString()).toBe(true);
            const beforeQuotedStringQuote = doc.getTokenCursor(46);
            expect(beforeQuotedStringQuote.withinString()).toBe(true);
            const inQuotedStringQuote = doc.getTokenCursor(47);
            expect(inQuotedStringQuote.withinString()).toBe(true);
            const afterQuotedStringQuote = doc.getTokenCursor(48);
            expect(afterQuotedStringQuote.withinString()).toBe(true);
            const beforeLiteralQuote = doc.getTokenCursor(50);
            expect(beforeLiteralQuote.withinString()).toBe(false);
            const inLiteralQuote = doc.getTokenCursor(51);
            expect(inLiteralQuote.withinString()).toBe(false);
            const afterLiteralQuote = doc.getTokenCursor(52);
            expect(afterLiteralQuote.withinString()).toBe(false);
        });
    });
});
