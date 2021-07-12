import * as expect from 'expect';
import { LispTokenCursor } from '../../../cursor-doc/token-cursor';
import * as mock from '../common/mock';
import { docFromTextNotation, textAndSelection } from '../common/text-notation';

describe('Token Cursor', () => {
    describe('forwardSexp', () => {
        it('moves from beginning to end of symbol', () => {
            const a = docFromTextNotation('(a(b(|c•#f•(#b •[:f :b :z])•#z•1)))')
            const b = docFromTextNotation('(a(b(c|•#f•(#b •[:f :b :z])•#z•1)))')
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            cursor.forwardSexp();
            expect(cursor.offsetStart).toBe(b.selectionLeft);
        });
        it('moves from beginning to end of nested list ', () => {
            const a = docFromTextNotation('|(a(b(c•#f•(#b •[:f :b :z])•#z•1)))')
            const b = docFromTextNotation('(a(b(c•#f•(#b •[:f :b :z])•#z•1)))|')
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            cursor.forwardSexp();
            expect(cursor.offsetStart).toBe(b.selectionLeft);
        });
        it('Includes reader tag as part of a list form', () => {
            const a = docFromTextNotation('(a(b(c|•#f•(#b •[:f :b :z])•#z•1)))')
            const b = docFromTextNotation('(a(b(c•#f•(#b •[:f :b :z])|•#z•1)))')
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            cursor.forwardSexp();
            expect(cursor.offsetStart).toBe(b.selectionLeft);
        });
        it('Includes reader tag as part of a symbol', () => {
            const a = docFromTextNotation('(a(b(c•#f•(#b •[:f :b :z])|•#z•1)))')
            const b = docFromTextNotation('(a(b(c•#f•(#b •[:f :b :z])•#z•1|)))')
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            cursor.forwardSexp();
            expect(cursor.offsetStart).toBe(b.selectionLeft);
        });
        it('Does not move out of a list', () => {
            const a = docFromTextNotation('(a(b(c•#f•(#b •[:f :b :z])•#z•1|)))')
            const b = docFromTextNotation('(a(b(c•#f•(#b •[:f :b :z])•#z•1|)))')
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            cursor.forwardSexp();
            expect(cursor.offsetStart).toBe(b.selectionLeft);
        });
        it('Skip metadata if skipMetadata is true', () => {
            const a = docFromTextNotation('(a |^{:a 1} (= 1 1))');
            const b = docFromTextNotation('(a ^{:a 1} (= 1 1)|)');
            const cursor = a.getTokenCursor(a.selectionLeft);
            cursor.forwardSexp(true, true);
            expect(cursor.offsetStart).toBe(b.selectionLeft);
        });
        it('Skips multiple metadata maps if skipMetadata is true', () => {
            const a = docFromTextNotation('(a |^{:a 1} ^{:b 2} (= 1 1))');
            const b = docFromTextNotation('(a ^{:a 1} ^{:b 2} (= 1 1)|)');
            const cursor = a.getTokenCursor(a.selectionLeft);
            cursor.forwardSexp(true, true);
            expect(cursor.offsetStart).toBe(b.selectionLeft);
        });
        it('Skips symbol shorthand for metadata if skipMetadata is true', () => {
            const a = docFromTextNotation('(a| ^String (= 1 1))');
            const b = docFromTextNotation('(a ^String (= 1 1)|)');
            const cursor = a.getTokenCursor(a.selectionLeft);
            cursor.forwardSexp(true, true);
            expect(cursor.offsetStart).toBe(b.selectionLeft);
        });
        it('Skips keyword shorthand for metadata if skipMetadata is true', () => {
            const a = docFromTextNotation('(a| ^:hello (= 1 1))');
            const b = docFromTextNotation('(a ^:hello (= 1 1)|)');
            const cursor = a.getTokenCursor(a.selectionLeft);
            cursor.forwardSexp(true, true);
            expect(cursor.offsetStart).toBe(b.selectionLeft);
        });
        it('Skips multiple keyword shorthands for metadata if skipMetadata is true', () => {
            const a = docFromTextNotation('(a| ^:hello ^:world (= 1 1))');
            const b = docFromTextNotation('(a ^:hello ^:world (= 1 1)|)');
            const cursor = a.getTokenCursor(a.selectionLeft);
            cursor.forwardSexp(true, true);
            expect(cursor.offsetStart).toBe(b.selectionLeft);
        });
        it('Does not skip ignored forms if skipIgnoredForms is false', () => {
            const a = docFromTextNotation('(a| #_1 #_2 3)');
            const b = docFromTextNotation('(a #_|1 #_2 3)');
            const cursor = a.getTokenCursor(a.selectionLeft);
            cursor.forwardSexp(true, true);
            expect(cursor.offsetStart).toBe(b.selectionLeft);
        });
        it('Skip ignored forms if skipIgnoredForms is true', () => {
            const a = docFromTextNotation('(a| #_1 #_2 3)');
            const b = docFromTextNotation('(a #_1 #_2 3|)');
            const cursor = a.getTokenCursor(a.selectionLeft);
            cursor.forwardSexp(true, true, true);
            expect(cursor.offsetStart).toBe(b.selectionLeft);
        });
        it('should skip stacked ignored forms if skipIgnoredForms is true', () => {
            const a = docFromTextNotation('(a| #_ #_ 1 2 3)');
            const b = docFromTextNotation('(a #_ #_ 1 2 3|)');
            const cursor = a.getTokenCursor(a.selectionLeft);
            cursor.forwardSexp(true, true, true);
            expect(cursor.offsetStart).toBe(b.selectionLeft);
        });
        it.skip('Does not move past unbalanced top level form', () => {
            //TODO: Figure out why this doesn't work
            const d = docFromTextNotation('|(foo "bar"');
            const cursor: LispTokenCursor = d.getTokenCursor(d.selectionLeft);
            cursor.forwardSexp();
            expect(cursor.offsetStart).toBe(d.selectionLeft);
        });
        it.skip('Does not move past unbalanced top level form', () => {
            //TODO: Figure out why this breaks some tests run after this one
            const d = docFromTextNotation('|(foo "bar');
            const cursor: LispTokenCursor = d.getTokenCursor(d.selectionLeft);
            cursor.forwardSexp();
            expect(cursor.offsetStart).toBe(d.selectionLeft);
        });
    });

    describe('backardSexp', () => {
        it('moves from end to beginning of symbol', () => {
            const a = docFromTextNotation('(a(b(c|•#f•(#b •[:f :b :z])•#z•1)))')
            const b = docFromTextNotation('(a(b(|c•#f•(#b •[:f :b :z])•#z•1)))')
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            cursor.backwardSexp();
            expect(cursor.offsetStart).toBe(b.selectionLeft);
        });
        it('moves from end to beginning of nested list ', () => {
            const a = docFromTextNotation('(a(b(c•#f•(#b •[:f :b :z])•#z•1)))|')
            const b = docFromTextNotation('|(a(b(c•#f•(#b •[:f :b :z])•#z•1)))')
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            cursor.backwardSexp();
            expect(cursor.offsetStart).toBe(b.selectionLeft);
        });
        it('Includes reader tag as part of a list form', () => {
            const a = docFromTextNotation('(a(b(c•#f•(#b •[:f :b :z])|•#z•1)))')
            const b = docFromTextNotation('(a(b(c•|#f•(#b •[:f :b :z])•#z•1)))')
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            cursor.backwardSexp();
            expect(cursor.offsetStart).toBe(b.selectionLeft);
        });
        it('Includes reader tag as part of a symbol', () => {
            const a = docFromTextNotation('(a(b(c•#f•(#b •[:f :b :z])•#z•1|)))')
            const b = docFromTextNotation('(a(b(c•#f•(#b •[:f :b :z])•|#z•1)))')
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            cursor.backwardSexp();
            expect(cursor.offsetStart).toBe(b.selectionLeft);
        });
        it('Does not move out of a list', () => {
            const a = docFromTextNotation('(a(|b(c•#f•(#b •[:f :b :z])•#z•1)))')
            const b = docFromTextNotation('(a(|b(c•#f•(#b •[:f :b :z])•#z•1)))')
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            cursor.backwardSexp();
            expect(cursor.offsetStart).toBe(b.selectionLeft);
        });
    });

    describe('downList', () => {

        it('Puts cursor to the right of the following open paren', () => {
            const a = docFromTextNotation('(a |(b 1))')
            const b = docFromTextNotation('(a (|b 1))')
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            cursor.downList();
            expect(cursor.offsetStart).toBe(b.selectionLeft);
        });
        it('Puts cursor to the right of the following open curly brace:', () => {
            const a = docFromTextNotation('(a |{:b 1}))')
            const b = docFromTextNotation('(a {|:b 1}))')
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            cursor.downList();
            expect(cursor.offsetStart).toBe(b.selectionLeft);
        });
        it('Puts cursor to the right of the following open bracket', () => {
            const a = docFromTextNotation('(a| [1 2]))')
            const b = docFromTextNotation('(a [|1 2]))')
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            cursor.downList();
            expect(cursor.offsetStart).toBe(b.selectionLeft);
        });
        it(`Puts cursor to the right of the following opening quoted list`, () => {
            const a = docFromTextNotation(`(a| '(b 1))`)
            const b = docFromTextNotation(`(a '(|b 1))`)
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            cursor.downList();
            expect(cursor.offsetStart).toBe(b.selectionLeft);
        });
        it('Skips whitespace', () => {
            const a = docFromTextNotation('(a|•  (b 1))')
            const b = docFromTextNotation('(a•  (|b 1))')
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            cursor.downList();
            expect(cursor.offsetStart).toBe(b.selectionLeft);
        });
        it('Does not skip metadata by default', () => {
            const a = docFromTextNotation('(a| ^{:x 1} (b 1))')
            const b = docFromTextNotation('(a ^{|:x 1} (b 1))')
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            cursor.downList();
            expect(cursor.offsetStart).toBe(b.selectionLeft);
        });
        it('Skips metadata when skipMetadata is true', () => {
            const a = docFromTextNotation('(a| ^{:x 1} (b 1))')
            const b = docFromTextNotation('(a ^{:x 1} (|b 1))')
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            cursor.downList(true);
            expect(cursor.offsetStart).toBe(b.selectionLeft);
        });
    });

    it('forwardList', () => {
        const a = docFromTextNotation('(a(b(c•|#f•(#b •[:f :b :z])•#z•1)))');
        const b = docFromTextNotation('(a(b(c•#f•(#b •[:f :b :z])•#z•1|)))');
        const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
        cursor.forwardList();
        expect(cursor.offsetStart).toBe(b.selectionLeft);
    });
    it('upList', () => {
        const a = docFromTextNotation('(a(b(c•#f•(#b •[:f :b :z])•#z•1|)))');
        const b = docFromTextNotation('(a(b(c•#f•(#b •[:f :b :z])•#z•1)|))');
        const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
        cursor.upList();
        expect(cursor.offsetStart).toBe(b.selectionLeft);
    });
    it('backwardList', () => {
        const a = docFromTextNotation('(a(b(c•#f•(#b •[:f :b :z])•#z•|1)))');
        const b = docFromTextNotation('(a(b(|c•#f•(#b •[:f :b :z])•#z•1)))');
        const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
        cursor.backwardList();
        expect(cursor.offsetStart).toBe(b.selectionLeft);
    });

    it('backwardUpList', () => {
        const a = docFromTextNotation('(a(b(c•#f•(#b •|[:f :b :z])•#z•1)))');
        const b = docFromTextNotation('(a(b(c•|#f•(#b •[:f :b :z])•#z•1)))');
        const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
        cursor.backwardUpList();
        expect(cursor.offsetStart).toBe(b.selectionLeft);
    });

    // TODO: Figure out why adding these tests make other test break!
    describe('Navigation in and around strings', () => {
        it('backwardList moves to start of string', () => {
            const a = docFromTextNotation('(str [] "", "foo" "f |  b  b"   "   f b b   " "\\"" \\")');
            const b = docFromTextNotation('(str [] "", "foo" "|f   b  b"   "   f b b   " "\\"" \\")');
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            cursor.backwardList();
            expect(cursor.offsetStart).toEqual(b.selectionLeft);
        });
        it('forwardList moves to end of string', () => {
            const a = docFromTextNotation('(str [] "", "foo" "f |  b  b"   "   f b b   " "\\"" \\")');
            const b = docFromTextNotation('(str [] "", "foo" "f   b  b|"   "   f b b   " "\\"" \\")');
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            cursor.forwardList();
            expect(cursor.offsetStart).toEqual(b.selectionLeft);
        });
        it('backwardSexpr inside string moves past quoted characters', () => {
            const a = docFromTextNotation('(str [] "foo \\"| bar")');
            const b = docFromTextNotation('(str [] "foo |\\" bar")');
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            cursor.backwardSexp();
            expect(cursor.offsetStart).toEqual(b.selectionLeft);
        });
    })

    describe('Current Form', () => {
        it('0: selects from within non-list form', () => {
            const a = docFromTextNotation('(a|aa (bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)))');
            const b = docFromTextNotation('(|aaa| (bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)))');
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            expect(cursor.rangeForCurrentForm(a.selectionLeft)).toEqual(textAndSelection(b)[1]);
        });
        it('1: selects from adjacent after form', () => {
            const a = docFromTextNotation('(aaa (bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c)|)•#baz•yyy•   z z z   •foo•   •   bar)))');
            const b = docFromTextNotation('(aaa (bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x•|#(a b c)|)•#baz•yyy•   z z z   •foo•   •   bar)))');
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            expect(cursor.rangeForCurrentForm(a.selectionLeft)).toEqual(textAndSelection(b)[1]);
        });
        it('1: selects from adjacent after form, including reader tags', () => {
            const a = docFromTextNotation('(aaa (bbb (ccc •#foo•(#bar •#baz•[:a :b :c]|•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)))');
            const b = docFromTextNotation('(aaa (bbb (ccc •#foo•(|#bar •#baz•[:a :b :c]|•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)))');
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            expect(cursor.rangeForCurrentForm(a.selectionLeft)).toEqual(textAndSelection(b)[1]);
        });
        it('2: selects from adjacent before form', () => {
            const a = docFromTextNotation('(aaa (bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x•|#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)))');
            const b = docFromTextNotation('(aaa (bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x•|#(a b c)|)•#baz•yyy•   z z z   •foo•   •   bar)))');
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            expect(cursor.rangeForCurrentForm(a.selectionLeft)).toEqual(textAndSelection(b)[1]);
        });
        it('2: selects from adjacent before form, including reader tags', () => {
            const a = docFromTextNotation('(aaa (bbb (ccc •#foo•(|#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)))');
            const b = docFromTextNotation('(aaa (bbb (ccc •#foo•(|#bar •#baz•[:a :b :c]|•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)))');
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            expect(cursor.rangeForCurrentForm(a.selectionLeft)).toEqual(textAndSelection(b)[1]);
        });
        it('2: selects from adjacent before form, or in readers', () => {
            const a = docFromTextNotation('(aaa (bbb (ccc •#foo•|(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)))');
            const b = docFromTextNotation('(aaa (bbb (ccc •|#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))|•#baz•yyy•   z z z   •foo•   •   bar)))');
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            expect(cursor.rangeForCurrentForm(a.selectionLeft)).toEqual(textAndSelection(b)[1]);
        });
        it('2: selects from adjacent before a form with reader tags', () => {
            const a = docFromTextNotation('(aaa (bbb (ccc •#foo•(#bar |•#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)))');
            const b = docFromTextNotation('(aaa (bbb (ccc •#foo•(|#bar •#baz•[:a :b :c]|•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)))');
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            expect(cursor.rangeForCurrentForm(a.selectionLeft)).toEqual(textAndSelection(b)[1]);
        });
        it('3: selects previous form, if on the same line', () => {
            const a = docFromTextNotation('(aaa (bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z  | •foo•   •   bar)))');
            const b = docFromTextNotation('(aaa (bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z |z|   •foo•   •   bar)))');
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            expect(cursor.rangeForCurrentForm(a.selectionLeft)).toEqual(textAndSelection(b)[1]);
        });
        it('4: selects next form, if on the same line', () => {
            const a = docFromTextNotation('(aaa (bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•|   z z z   •foo•   •   bar)))');
            const b = docFromTextNotation('(aaa (bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   |z| z z   •foo•   •   bar)))');
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            expect(cursor.rangeForCurrentForm(a.selectionLeft)).toEqual(textAndSelection(b)[1]);
        });
        it('5: selects previous form, if any', () => {
            const a = docFromTextNotation('(aaa (bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   |•   bar)))');
            const b = docFromTextNotation('(aaa (bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z   •|foo|•   •   bar)))');
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            expect(cursor.rangeForCurrentForm(a.selectionLeft)).toEqual(textAndSelection(b)[1]);
        });
        it('6: selects next form, if any', () => {
            const a = docFromTextNotation(' | •  (foo {:a b})•(c)');
            const b = docFromTextNotation('  •  |(foo {:a b})|•(c)');
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            expect(cursor.rangeForCurrentForm(a.selectionLeft)).toEqual(textAndSelection(b)[1]);
        });
        it('7: selects enclosing form, if any', () => {
            const a = docFromTextNotation('(|)  •  (foo {:a b})•(c)');
            const b = docFromTextNotation('|()|  •  (foo {:a b})•(c)');
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            expect(cursor.rangeForCurrentForm(a.selectionLeft)).toEqual(textAndSelection(b)[1]);
        });
        it('2: selects anonymous function when cursor is before #', () => {
            const a = docFromTextNotation('(map |#(println %) [1 2])');
            const b = docFromTextNotation('(map |#(println %)| [1 2])');
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            expect(cursor.rangeForCurrentForm(a.selectionLeft)).toEqual(textAndSelection(b)[1]);
        });
        it('2: selects anonymous function when cursor is after # and before (', () => {
            const a = docFromTextNotation('(map #|(println %) [1 2])');
            const b = docFromTextNotation('(map |#(println %)| [1 2])');
            const cursor: LispTokenCursor = a.getTokenCursor(a.selectionLeft);
            expect(cursor.rangeForCurrentForm(a.selectionLeft)).toEqual(textAndSelection(b)[1]);
        });
    });

    describe('Top Level Form', () => {
        it('Finds range for a regular top level form', () => {
            const a = docFromTextNotation('aaa (bbb (ccc •#foo•(#bar •#baz•[:a :b| :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)) (ddd eee)');
            const b = docFromTextNotation('aaa |(bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar))| (ddd eee)');
            const cursor: LispTokenCursor = a.getTokenCursor(0);
            expect(cursor.rangeForDefun(a.selectionLeft)).toEqual(textAndSelection(b)[1]);
        });
        it('Finds range for a top level form inside a comment', () => {
            const a = docFromTextNotation('aaa (comment (ccc •#foo•(#bar •#baz•[:a :b| :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)) (ddd eee)');
            const b = docFromTextNotation('aaa (comment |(ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)|) (ddd eee)');
            const cursor: LispTokenCursor = a.getTokenCursor(0);
            expect(cursor.rangeForDefun(a.selectionLeft)).toEqual(textAndSelection(b)[1]);
        });
        it('Can find the comment range for a top level form inside a comment', () => {
            const a = docFromTextNotation('aaa (comment (ccc •#foo•(#bar •#baz•[:a :b| :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)) (ddd eee)');
            const b = docFromTextNotation('aaa |(comment (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar))| (ddd eee)');
            const cursor: LispTokenCursor = a.getTokenCursor(0);
            expect(cursor.rangeForDefun(a.selectionLeft, 0, false)).toEqual(textAndSelection(b)[1]);
        });
        it('Finds comment range when comments are nested', () => { // TODO: Consider changing this behavior
            const a = docFromTextNotation('aaa (comment (comment [bbb ccc] | ddd))');
            const b = docFromTextNotation('aaa (comment |(comment [bbb ccc]  ddd)|)');
            const cursor: LispTokenCursor = a.getTokenCursor(0);
            expect(cursor.rangeForDefun(a.selectionLeft)).toEqual(textAndSelection(b)[1]);
        });
        it('Includes reader tag', () => {
            const a = docFromTextNotation('aaa (comment #r [bbb ccc|]  ddd)');
            const b = docFromTextNotation('aaa (comment |#r [bbb ccc]|  ddd)');
            const cursor: LispTokenCursor = a.getTokenCursor(0);
            expect(cursor.rangeForDefun(a.selectionLeft)).toEqual(textAndSelection(b)[1]);
        });
        it('Finds the preceding range when cursor is between to forms on the same line', () => {
            const a = docFromTextNotation('aaa (comment [bbb ccc] | ddd)');
            const b = docFromTextNotation('aaa (comment |[bbb ccc]|  ddd)');
            const cursor: LispTokenCursor = a.getTokenCursor(0);
            expect(cursor.rangeForDefun(a.selectionLeft)).toEqual(textAndSelection(b)[1]);
        });
        it('Finds the succeeding range when cursor is at the start of the line', () => {
            const a = docFromTextNotation('aaa (comment [bbb ccc]• | ddd)');
            const b = docFromTextNotation('aaa (comment [bbb ccc]•  |ddd|)');
            const cursor: LispTokenCursor = a.getTokenCursor(0);
            expect(cursor.rangeForDefun(a.selectionLeft)).toEqual(textAndSelection(b)[1]);
        });

    });
    describe('Top Level Form 2', () => {
        it('Finds range for a regular top level form', () => {
            const a = docFromTextNotation('aaa (bbb (ccc •#foo•(#bar •#baz•[:a :b| :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)) (ddd eee)');
            const b = docFromTextNotation('aaa |(bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar))| (ddd eee)');
            const cursor: LispTokenCursor = a.getTokenCursor(a.selection.active);
            expect(cursor.rangeForDefun2(a.selection.active)).toEqual(textAndSelection(b)[1]);
        });
        it('Finds range for a top level form inside a comment', () => {
            const a = docFromTextNotation('aaa (comment (comment [bbb cc|c]  ddd))');
            const b = docFromTextNotation('aaa (comment (comment |[bbb ccc]|  ddd))');
            const cursor: LispTokenCursor = a.getTokenCursor(a.selection.active);
            expect(cursor.rangeForDefun2(a.selection.active)).toEqual(textAndSelection(b)[1]);
        });
        it('Can find the comment range for a top level form inside a comment', () => {
            const a = docFromTextNotation('aaa (comment (ccc •#foo•(#bar •#baz•[:a :b| :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)) (ddd eee)');
            const b = docFromTextNotation('aaa |(comment (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar))| (ddd eee)');
            const cursor: LispTokenCursor = a.getTokenCursor(a.selection.active);
            expect(cursor.rangeForDefun2(a.selection.active, false)).toEqual(textAndSelection(b)[1]);
        });
        it('Finds comment range when comments are nested', () => { // TODO: Consider changing this behavior
            const a = docFromTextNotation('aaa (comment (comment [bbb ccc] | ddd))');
            const b = docFromTextNotation('aaa (comment (comment |[bbb ccc]|  ddd))');
            const cursor: LispTokenCursor = a.getTokenCursor(a.selection.active);
            expect(cursor.rangeForDefun2(a.selection.active)).toEqual(textAndSelection(b)[1]);
        });
        it('Includes reader tag', () => {
            const a = docFromTextNotation('aaa (comment #r [bbb ccc|]  ddd)');
            const b = docFromTextNotation('aaa (comment |#r [bbb ccc]|  ddd)');
            const cursor: LispTokenCursor = a.getTokenCursor(a.selection.active);
            expect(cursor.rangeForDefun2(a.selection.active)).toEqual(textAndSelection(b)[1]);
        });
        it('Finds the preceding range when cursor is between to forms on the same line', () => {
            const a = docFromTextNotation('aaa (comment [bbb ccc] | ddd)');
            const b = docFromTextNotation('aaa (comment |[bbb ccc]|  ddd)');
            const cursor: LispTokenCursor = a.getTokenCursor(a.selection.active);
            expect(cursor.rangeForDefun2(a.selection.active)).toEqual(textAndSelection(b)[1]);
        });
        it('Finds the succeeding range when cursor is at the start of the line', () => {
            const a = docFromTextNotation('aaa (comment [bbb ccc]• | ddd)');
            const b = docFromTextNotation('aaa (comment [bbb ccc]•  |ddd|)');
            const cursor: LispTokenCursor = a.getTokenCursor(a.selection.active);
            expect(cursor.rangeForDefun2(a.selection.active)).toEqual(textAndSelection(b)[1]);
        });
    });
    describe('Location State', () => {
        it('Knows when inside string', () => {
            const doc = docFromTextNotation('(str [] "", "foo" "f   b  b"   "   f b b   " "\\"" \\")');
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
