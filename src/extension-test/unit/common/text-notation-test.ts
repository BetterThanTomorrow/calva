import * as expect from 'expect';
import * as textNotation from '../common/text-notation';

describe('text-notation test utils', () => {
  describe('textNotationFromDoc', () => {
    it('should return the same input text to textNotationFromDoc', () => {
      const inputText = '(a b|1) (a b|) (a (b))';
      const doc = textNotation.docFromTextNotation(inputText);
      expect(textNotation.textNotationFromDoc(doc)).toEqual(inputText);
    });
  });
  describe('docFromTextNotation', () => {
    it('creates single cursor position', () => {
      const tn = '(a b|1)';
      const text = '(a b)';
      // TODO: Figure out why we need undefined here?
      // const selections = [undefined, [4, 4]];
      const selections = [[4, 4]];
      const doc = textNotation.docFromTextNotation(tn);
      expect(textNotation.textAndSelection(doc)).toEqual([text, selections]);
    });
  });
});
