import * as expect from 'expect';
import { testCljOrJsRegex } from '../../../util/regex';

describe('regex', () => {
  describe('testCljOrJsRegex', () => {
    it('works with the clojure regex string', () => {
      expect(testCljOrJsRegex('#"^\\w"', 'function1')).toBeTruthy();
    });
    it('works with the js regex string', () => {
      expect(testCljOrJsRegex('/^\\w/', 'function1')).toBeTruthy();
    });
    it('works with the plain text', () => {
      expect(testCljOrJsRegex('ANY', 'ANY')).toBeTruthy();
    });
  });
});
