import * as expect from 'expect';
import { LispTokenCursor } from '../../../cursor-doc/token-cursor';
import * as mock from '../common/mock';
import { docFromDot, textAndSelection, dotToNl } from '../common/text-notation';
import * as getText from '../../../util/cursor-get-text';

describe('getTopLevelFunction', () => {
    it('Finds top level function at top', () => {
        const doc: mock.MockDocument = docFromDot('(foo bar)•(deftest a-test•  (baz |gaz))');
        const cursor: LispTokenCursor = doc.getTokenCursor(doc.selection.active);
        expect(getText.currentTopLevelFunction(cursor)[1]).toEqual('a-test');
    });

    it('Finds top level function when nested', () => {
        const doc: mock.MockDocument = docFromDot('(foo bar)•(with-test•  (deftest a-test•    (baz |gaz)))');
        const cursor: LispTokenCursor = doc.getTokenCursor(doc.selection.active);
        expect(getText.currentTopLevelFunction(cursor)[1]).toEqual('a-test');
    });

});
