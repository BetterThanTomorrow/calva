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
});
