import * as expectLib from 'expect';
import * as model from '../../../cursor-doc/model';
import * as utilities from '../../../cursor-doc/utilities';
import * as textNotation from '../common/text-notation';
//import { docFromTextNotation, textAndSelection } from '../common/text-notation';

model.initScanner(20000);

describe('Utilities that need cursor doc things', () => {
  describe('addMissingBrackets', () => {
    it('Adds missing brackets', () => {
      const text = '(a b) (c {:d [1 2 3 "four"';
      const append = ']})';
      expectLib.expect(utilities.getMissingBrackets(text)).toEqual({ append: append, prepend: '' });
    });
    it('Closes strings', () => {
      const text = '(a b) (c {:d [1 2 3 "four';
      const append = '"]})';
      expectLib.expect(utilities.getMissingBrackets(text)).toEqual({ append: append, prepend: '' });
    });
    it('Leaves non-broken structure alone', () => {
      const text = '(a b) (c {:d [1 2 3 "four"] :e :f} g) h';
      expectLib.expect(utilities.getMissingBrackets(text)).toEqual({ append: '', prepend: '' });
    });
    it('Adds missing opening brackets', () => {
      const text = '(a b) (c {:d [1 2 3 "four"]}) extra ] closing } brackets)';
      const prepend = '({[';
      expectLib
        .expect(utilities.getMissingBrackets(text))
        .toEqual({ append: '', prepend: prepend });
    });
    it('Ignores brackets in strings', () => {
      const text = '(a b) "{{" (c {:d [1 2 3 "four([{" [';
      const append = ']]})';
      expectLib.expect(utilities.getMissingBrackets(text)).toEqual({ append: append, prepend: '' });
    });
    it('Ignores brackets in line comments', () => {
      const text = '(a b) (c {:d \n; ( [ ( {\n[1 2 3 "four"';
      const append = ']})';
      expectLib.expect(utilities.getMissingBrackets(text)).toEqual({ append: append, prepend: '' });
    });
  });
  describe('isRightSexpStructural', () => {
    it('map', () => {
      const cursor = textNotation.docFromTextNotation('|{:a 1}').getTokenCursor(0);
      expectLib.expect(utilities.isRightSexpStructural(cursor)).toBe(true);
    });
    it('Tagged map', () => {
      const cursor = textNotation.docFromTextNotation('|#foo {:a 1}').getTokenCursor(0);
      expectLib.expect(utilities.isRightSexpStructural(cursor)).toBe(true);
    });
  });
  describe('structureForRightSexp', () => {
    it('[map]', () => {
      const cursor = textNotation.docFromTextNotation('|[{:a 1}]').getTokenCursor(0);
      expectLib.expect(utilities.structureForRightSexp(cursor)).toEqual([
        {
          originalString: '{:a 1}',
          value: new Map<any, any>([
            [
              { value: ':a', originalString: ':a' },
              { value: '1', originalString: '1' },
            ],
          ]),
        },
      ]);
    });
    it('[tagged map]', () => {
      const cursor = textNotation.docFromTextNotation('|[#t {:a 1}]').getTokenCursor(0);
      expectLib.expect(utilities.structureForRightSexp(cursor)).toEqual([
        {
          originalString: '#t {:a 1}',
          value: new Map<any, any>([
            [
              { value: ':a', originalString: ':a' },
              { value: '1', originalString: '1' },
            ],
          ]),
        },
      ]);
    });
  });
  describe('wordRangeAtOffset', () => {
    const wordRange = (s: string) => {
      const doc = textNotation.docFromTextNotation(s);
      return utilities.wordRangeAtOffset(doc, doc.selections[0].active);
    };
    it('Gives the word around the offset', () => {
      expectLib.expect(wordRange('(str/upp|er "x")')).toEqual([1, 10]);
    });
    it('Gives a word that ends at the offset', () => {
      expectLib.expect(wordRange('(map| inc)')).toEqual([1, 4]);
    });
    it('Gives a word that starts at the offset', () => {
      expectLib.expect(wordRange('(|map inc)')).toEqual([1, 4]);
    });
    it('Leaves out the characters Clojure words stop at', () => {
      expectLib.expect(wordRange('@fo|o')).toEqual([1, 4]);
      expectLib.expect(wordRange("#'fo|o")).toEqual([1, 5]);
      expectLib.expect(wordRange('[a,b|]')).toEqual([3, 4]);
    });
    it('Keeps to the line of the offset', () => {
      expectLib.expect(wordRange('foo•|bar')).toEqual([4, 7]);
      expectLib.expect(wordRange('foo|•bar')).toEqual([0, 3]);
    });
    it('Gives undefined when there is no word at the offset', () => {
      expectLib.expect(wordRange('(|)')).toBeUndefined();
      expectLib.expect(wordRange('( | )')).toBeUndefined();
    });
  });
  describe('wordAtOffset', () => {
    const word = (s: string) => {
      const doc = textNotation.docFromTextNotation(s);
      return utilities.wordAtOffset(doc, doc.selections[0].active);
    };
    it('Gives the word around the offset', () => {
      expectLib.expect(word('(ma|p inc)')).toBe('map');
    });
    it('Drops a leading syntax quote', () => {
      expectLib.expect(word('(foo `ba|r)')).toBe('bar');
    });
    it('Gives an empty string when there is no word at the offset', () => {
      expectLib.expect(word('(|)')).toBe('');
    });
  });
});
