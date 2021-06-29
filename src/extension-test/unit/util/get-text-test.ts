import * as expect from 'expect';
import * as mock from '../common/mock';
import { docFromTextNotation } from '../common/text-notation';
import * as getText from '../../../util/cursor-get-text';

describe('get text', () => {

    describe('getTopLevelFunction', () => {
        it('Finds top level function at top', () => {
            const doc: mock.MockDocument = docFromTextNotation('(foo bar)•(deftest a-test•  (baz |gaz))');
            const selDoc: mock.MockDocument = docFromTextNotation('(foo bar)•(deftest |a-test|•  (baz gaz))');
            expect(getText.currentTopLevelFunction(doc)).toEqual([[selDoc.selectionLeft, selDoc.selectionRight], 'a-test']);
        });

        it('Finds top level function when nested', () => {
            const doc: mock.MockDocument = docFromTextNotation('(foo bar)•(with-test•  (deftest a-test•    (baz |gaz)))');
            const selDoc: mock.MockDocument = docFromTextNotation('(foo bar)•(with-test•  (deftest |a-test|•    (baz gaz)))');
            expect(getText.currentTopLevelFunction(doc)).toEqual([[selDoc.selectionLeft, selDoc.selectionRight], 'a-test']);
        });

        it('Finds top level function when namespaced def-macro', () => {
            // https://github.com/BetterThanTomorrow/calva/issues/1086
            const doc: mock.MockDocument = docFromTextNotation('(foo bar)•(with-test•  (t/deftest a-test•    (baz |gaz)))');
            const selDoc: mock.MockDocument = docFromTextNotation('(foo bar)•(with-test•  (t/deftest |a-test|•    (baz gaz)))');
            expect(getText.currentTopLevelFunction(doc)).toEqual([[selDoc.selectionLeft, selDoc.selectionRight], 'a-test']);
        });

    });

    describe('getTopLevelForm', () => {
        it('Finds top level form', () => {
            const doc: mock.MockDocument = docFromTextNotation('(foo bar)•(deftest a-test•  (baz |gaz))');
            const selDoc: mock.MockDocument = docFromTextNotation('(foo bar)•|(deftest a-test•  (baz gaz))|');
            expect(getText.currentTopLevelForm(doc)).toEqual([[selDoc.selectionLeft, selDoc.selectionRight], '(deftest a-test\n  (baz gaz))']);
        });
    });

    describe('topLevelFormToCursor', () => {
        it('Finds top level form from start to cursor', () => {
            const a: mock.MockDocument = docFromTextNotation('(foo bar)•(deftest a-test•  [baz ; f|oo•     gaz])');
            const b: mock.MockDocument = docFromTextNotation('(foo bar)•|(deftest a-test•  [baz| ; foo•     gaz])');
            expect(getText.currentTopLevelFormToCursor(a)).toEqual([[b.selectionLeft, b.selectionRight], '(deftest a-test\n  [baz])']);
        });
    });

    describe('startOfFileToCursor', () => {
        it('Builds form from start of file to cursor, when cursor in line comment', () => {
            const a: mock.MockDocument = docFromTextNotation('(foo bar)•(deftest a-test•  [baz ; f|oo•     gaz])•(bar baz)');
            const b: mock.MockDocument = docFromTextNotation('|(foo bar)•(deftest a-test•  [baz| ; foo•     gaz])•(bar baz)');
            expect(getText.startOfFileToCursor(a)).toEqual([[b.selectionLeft, b.selectionRight], '(foo bar)\n(deftest a-test\n  [baz])']);
        });
        it('Builds form from start of file to cursor, when cursor in comment macro', () => {
            const a: mock.MockDocument = docFromTextNotation('(foo bar)(comment• (deftest a-test•  [baz ; f|oo•     gaz])•(bar baz))');
            const b: mock.MockDocument = docFromTextNotation('|(foo bar)(comment• (deftest a-test•  [baz| ; foo•     gaz])•(bar baz))');
            expect(getText.startOfFileToCursor(a)).toEqual([[b.selectionLeft, b.selectionRight], '(foo bar)(comment\n (deftest a-test\n  [baz]))']);
        });
    });
});