import * as expect from 'expect';
import { docFromTextNotation, textNotationFromDoc } from '../common/text-notation';
import _ = require('lodash');

describe('text-notation test utils', () => {
  describe('textNotationFromDoc', () => {
    it('should return the same input text to textNotationFromDoc', () => {
      const inputText = '(a b|1) (a b|) (a (b))';
      const doc = docFromTextNotation(inputText);
      expect(textNotationFromDoc(doc)).toEqual(inputText);
    });
  });
});
