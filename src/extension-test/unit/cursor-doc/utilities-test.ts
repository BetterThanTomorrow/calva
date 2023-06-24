import * as expect from 'expect';
import * as utilities from '../../../cursor-doc/utilities';
//import { docFromTextNotation, textAndSelection } from '../common/text-notation';

describe('Utilities that need cursor doc things', () => {
  describe('addMissingBrackets', () => {
    it('Adds missing brackets', () => {
      const text = '(a b) (c {:d [1 2 3 "four"';
      const trail = ']})';
      expect(utilities.addMissingBrackets(text)).toEqual(`${text}${trail}`);
    });
    it('Closes strings', () => {
      const text = '(a b) (c {:d [1 2 3 "four';
      const trail = '"]})';
      expect(utilities.addMissingBrackets(text)).toEqual(`${text}${trail}`);
    });
    it('Leaves non-broken structure alone', () => {
      const text = '(a b) (c {:d [1 2 3 "four"] :e :f} g) h';
      expect(utilities.addMissingBrackets(text)).toEqual(text);
    });
    it('Adds missing opening brackets', () => {
      const text = '(a b) (c {:d [1 2 3 "four"]}) extra ] closing } brackets)';
      const head = '({[';
      expect(utilities.addMissingBrackets(text)).toEqual(`${head}${text}`);
    });
    it('Ignores brackets in strings', () => {
      const text = '(a b) "{{" (c {:d [1 2 3 "four([{" [';
      const trail = ']]})';
      expect(utilities.addMissingBrackets(text)).toEqual(`${text}${trail}`);
    });
    it('Ignores brackets in line comments', () => {
      const text = '(a b) (c {:d \n; ( [ ( {\n[1 2 3 "four"';
      const trail = ']})';
      expect(utilities.addMissingBrackets(text)).toEqual(`${text}${trail}`);
    });
  });
});
