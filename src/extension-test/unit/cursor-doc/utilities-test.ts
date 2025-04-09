import * as expect from 'expect';
import * as utilities from '../../../cursor-doc/utilities';
import { docFromTextNotation } from '../common/text-notation';
//import { docFromTextNotation, textAndSelection } from '../common/text-notation';

describe('Utilities that need cursor doc things', () => {
  describe('addMissingBrackets', () => {
    it('Adds missing brackets', () => {
      const text = '(a b) (c {:d [1 2 3 "four"';
      const append = ']})';
      expect(utilities.getMissingBrackets(text)).toEqual({ append: append, prepend: '' });
    });
    it('Closes strings', () => {
      const text = '(a b) (c {:d [1 2 3 "four';
      const append = '"]})';
      expect(utilities.getMissingBrackets(text)).toEqual({ append: append, prepend: '' });
    });
    it('Leaves non-broken structure alone', () => {
      const text = '(a b) (c {:d [1 2 3 "four"] :e :f} g) h';
      expect(utilities.getMissingBrackets(text)).toEqual({ append: '', prepend: '' });
    });
    it('Adds missing opening brackets', () => {
      const text = '(a b) (c {:d [1 2 3 "four"]}) extra ] closing } brackets)';
      const prepend = '({[';
      expect(utilities.getMissingBrackets(text)).toEqual({ append: '', prepend: prepend });
    });
    it('Ignores brackets in strings', () => {
      const text = '(a b) "{{" (c {:d [1 2 3 "four([{" [';
      const append = ']]})';
      expect(utilities.getMissingBrackets(text)).toEqual({ append: append, prepend: '' });
    });
    it('Ignores brackets in line comments', () => {
      const text = '(a b) (c {:d \n; ( [ ( {\n[1 2 3 "four"';
      const append = ']})';
      expect(utilities.getMissingBrackets(text)).toEqual({ append: append, prepend: '' });
    });
  });
  describe('isRightSexpStructural', () => {
    it('map', () => {
      const cursor = docFromTextNotation('|{:a 1}').getTokenCursor(0);
      expect(utilities.isRightSexpStructural(cursor)).toBe(true);
    });
    it('Tagged map', () => {
      const cursor = docFromTextNotation('|#foo {:a 1}').getTokenCursor(0);
      expect(utilities.isRightSexpStructural(cursor)).toBe(true);
    });
  });
  describe('structureForRightSexp', () => {
    it('[map]', () => {
      const cursor = docFromTextNotation('|[{:a 1}]').getTokenCursor(0);
      expect(utilities.structureForRightSexp(cursor)).toEqual([
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
      const cursor = docFromTextNotation('|[#t {:a 1}]').getTokenCursor(0);
      expect(utilities.structureForRightSexp(cursor)).toEqual([
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
});
