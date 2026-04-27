import * as expectLib from 'expect';
import * as string from '../../../util/string';

describe('string', () => {
  describe('keywordize', function () {
    it('keywordizes non-keywords', function () {
      expectLib.expect(':test').toBe(string.keywordize('test'));
    });
    it('leaves keywords alone', function () {
      expectLib.expect(':test').toBe(string.keywordize(':test'));
    });
  });

  describe('unKeywordize', function () {
    it('un-keywordizes keywords', function () {
      expectLib.expect('test').toBe(string.unKeywordize(':test'));
    });
    it('leaves non-keywords alone', function () {
      expectLib.expect('test').toBe(string.unKeywordize('test'));
    });
  });

  describe('getIndexAfterLastNonWhitespace', () => {
    it('returns correct index of end of string', () => {
      expectLib.expect(3).toBe(string.getIndexAfterLastNonWhitespace('123'));
    });
    it('ignores whitespace at end of string', () => {
      expectLib.expect(1).toBe(string.getIndexAfterLastNonWhitespace('> '));
    });
    it('ignores tab characters at end of string', () => {
      expectLib.expect(1).toBe(string.getIndexAfterLastNonWhitespace('>\t\t'));
    });
    it('ignores eol characters at end of string', () => {
      expectLib.expect(1).toBe(string.getIndexAfterLastNonWhitespace('>\n\r\n'));
    });
  });

  describe('testNameSearchPattern', () => {
    it('matches the exact test name in a namespace-qualified var', () => {
      const pattern = new RegExp(string.testNameSearchPattern('a-test'));
      expectLib.expect(pattern.test('my.ns/a-test')).toBe(true);
    });
    it('does not match a test name that is a substring prefix', () => {
      const pattern = new RegExp(string.testNameSearchPattern('a-test'));
      expectLib.expect(pattern.test('my.ns/a-test-b')).toBe(false);
    });
    it('does not match a test name that is a substring suffix', () => {
      const pattern = new RegExp(string.testNameSearchPattern('a-test'));
      expectLib.expect(pattern.test('my.ns/b-a-test')).toBe(false);
    });
    it('matches when the test name contains regex special characters', () => {
      const pattern = new RegExp(string.testNameSearchPattern('test.name+1'));
      expectLib.expect(pattern.test('my.ns/test.name+1')).toBe(true);
    });
    it('does not match partial with regex special characters', () => {
      const pattern = new RegExp(string.testNameSearchPattern('test.name+1'));
      expectLib.expect(pattern.test('my.ns/test.name+1-extra')).toBe(false);
    });
    it('matches a test name ending in a question mark', () => {
      const pattern = new RegExp(string.testNameSearchPattern('foo?'));
      expectLib.expect(pattern.test('my.ns/foo?')).toBe(true);
    });
    it('does not match without the question mark', () => {
      const pattern = new RegExp(string.testNameSearchPattern('foo?'));
      expectLib.expect(pattern.test('my.ns/foo')).toBe(false);
    });
    it('matches a test name containing an asterisk', () => {
      const pattern = new RegExp(string.testNameSearchPattern('*dynamic*'));
      expectLib.expect(pattern.test('my.ns/*dynamic*')).toBe(true);
    });
  });

  describe('getTextAfterLastOccurrenceOfSubstring', () => {
    it('returns text if substring does not exist', () => {
      expectLib
        .expect(string.getTextAfterLastOccurrenceOfSubstring('hello world', '123'))
        .toBe('hello world');
    });
    it('returns text after last occurrence of substring', () => {
      expectLib
        .expect('foo')
        .toBe(string.getTextAfterLastOccurrenceOfSubstring('hello > world\nprompt >foo', '>'));
    });
    it('returns text after last occurrenc of substring without trimming whitespace or eol characters', () => {
      expectLib
        .expect('\n\t foo \n\t')
        .toBe(string.getTextAfterLastOccurrenceOfSubstring('hello > world >\n\t foo \n\t', '>'));
    });
  });
});
