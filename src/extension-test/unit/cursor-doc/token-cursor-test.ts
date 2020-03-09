import { expect } from 'chai';
import { LispTokenCursor } from '../../../cursor-doc/token-cursor';
import * as mock from './mock';

describe('Token Cursor', () => {
    const docText = '(a(b(c\n#f\n(#b \n[:f :b :z])\n#z\n1)))',
        doc: mock.MockDocument = new mock.MockDocument();

    beforeEach(() => {
        doc.insertString(docText);
    });

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
});
