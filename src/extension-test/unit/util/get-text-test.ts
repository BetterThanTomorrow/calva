import * as expect from 'expect';
import * as mock from '../common/mock';
import { docFromDot } from '../common/text-notation';
import * as getText from '../../../util/cursor-get-text';

describe('getTopLevelFunction', () => {
    it('Finds top level function at top', () => {
        const doc: mock.MockDocument = docFromDot('(foo bar)•(deftest a-test•  (baz |gaz))');
        const selDoc: mock.MockDocument = docFromDot('(foo bar)•(deftest |a-test|•  (baz gaz))');
        expect(getText.currentTopLevelFunction(doc)).toEqual([[selDoc.selectionLeft, selDoc.selectionRight], 'a-test']);
    });
    
    it('Finds top level function when nested', () => {
        const doc: mock.MockDocument = docFromDot('(foo bar)•(with-test•  (deftest a-test•    (baz |gaz)))');
        const selDoc: mock.MockDocument = docFromDot('(foo bar)•(with-test•  (deftest |a-test|•    (baz gaz)))');
        expect(getText.currentTopLevelFunction(doc)).toEqual([[selDoc.selectionLeft, selDoc.selectionRight], 'a-test']);
    });

    it('Finds top level function when namespaced def-macro', () => {
        // https://github.com/BetterThanTomorrow/calva/issues/1086
        const doc: mock.MockDocument = docFromDot('(foo bar)•(with-test•  (t/deftest a-test•    (baz |gaz)))');
        const selDoc: mock.MockDocument = docFromDot('(foo bar)•(with-test•  (t/deftest |a-test|•    (baz gaz)))');
        expect(getText.currentTopLevelFunction(doc)).toEqual([[selDoc.selectionLeft, selDoc.selectionRight], 'a-test']);
    });

});
