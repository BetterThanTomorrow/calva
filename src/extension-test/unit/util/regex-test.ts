import * as expectLib from 'expect';
import * as regex from '../../../util/regex';

describe('regex', () => {
  describe('testCljOrJsRegex', () => {
    it('works with the clojure regex string', () => {
      expectLib.expect(regex.testCljOrJsRegex('#"^\\w"', 'function1')).toBeTruthy();
    });
    it('works with the js regex string', () => {
      expectLib.expect(regex.testCljOrJsRegex('/^\\w/', 'function1')).toBeTruthy();
    });
    it('works with the plain text', () => {
      expectLib.expect(regex.testCljOrJsRegex('ANY', 'ANY')).toBeTruthy();
    });
  });
});
