import * as expect from 'expect';
import {
  keywordize,
  unKeywordize,
  getIndexAfterLastNonWhitespace,
  getTextAfterLastOccurrenceOfSubstring,
  testNameSearchPattern,
} from '../../../util/string';

describe('string', () => {
  describe('keywordize', function () {
    it('keywordizes non-keywords', function () {
      expect(':test').toBe(keywordize('test'));
    });
    it('leaves keywords alone', function () {
      expect(':test').toBe(keywordize(':test'));
    });
  });

  describe('unKeywordize', function () {
    it('un-keywordizes keywords', function () {
      expect('test').toBe(unKeywordize(':test'));
    });
    it('leaves non-keywords alone', function () {
      expect('test').toBe(unKeywordize('test'));
    });
  });

  describe('getIndexAfterLastNonWhitespace', () => {
    it('returns correct index of end of string', () => {
      expect(3).toBe(getIndexAfterLastNonWhitespace('123'));
    });
    it('ignores whitespace at end of string', () => {
      expect(1).toBe(getIndexAfterLastNonWhitespace('> '));
    });
    it('ignores tab characters at end of string', () => {
      expect(1).toBe(getIndexAfterLastNonWhitespace('>\t\t'));
    });
    it('ignores eol characters at end of string', () => {
      expect(1).toBe(getIndexAfterLastNonWhitespace('>\n\r\n'));
    });
  });

  describe('testNameSearchPattern', () => {
    it('matches the exact test name in a namespace-qualified var', () => {
      const pattern = new RegExp(testNameSearchPattern('a-test'));
      expect(pattern.test('my.ns/a-test')).toBe(true);
    });
    it('does not match a test name that is a substring prefix', () => {
      const pattern = new RegExp(testNameSearchPattern('a-test'));
      expect(pattern.test('my.ns/a-test-b')).toBe(false);
    });
    it('does not match a test name that is a substring suffix', () => {
      const pattern = new RegExp(testNameSearchPattern('a-test'));
      expect(pattern.test('my.ns/b-a-test')).toBe(false);
    });
    it('matches when the test name contains regex special characters', () => {
      const pattern = new RegExp(testNameSearchPattern('test.name+1'));
      expect(pattern.test('my.ns/test.name+1')).toBe(true);
    });
    it('does not match partial with regex special characters', () => {
      const pattern = new RegExp(testNameSearchPattern('test.name+1'));
      expect(pattern.test('my.ns/test.name+1-extra')).toBe(false);
    });
    it('matches a test name ending in a question mark', () => {
      const pattern = new RegExp(testNameSearchPattern('foo?'));
      expect(pattern.test('my.ns/foo?')).toBe(true);
    });
    it('does not match without the question mark', () => {
      const pattern = new RegExp(testNameSearchPattern('foo?'));
      expect(pattern.test('my.ns/foo')).toBe(false);
    });
    it('matches a test name containing an asterisk', () => {
      const pattern = new RegExp(testNameSearchPattern('*dynamic*'));
      expect(pattern.test('my.ns/*dynamic*')).toBe(true);
    });
  });

  describe('getTextAfterLastOccurrenceOfSubstring', () => {
    it('returns text if substring does not exist', () => {
      expect(getTextAfterLastOccurrenceOfSubstring('hello world', '123')).toBe('hello world');
    });
    it('returns text after last occurrence of substring', () => {
      expect('foo').toBe(getTextAfterLastOccurrenceOfSubstring('hello > world\nprompt >foo', '>'));
    });
    it('returns text after last occurrenc of substring without trimming whitespace or eol characters', () => {
      expect('\n\t foo \n\t').toBe(
        getTextAfterLastOccurrenceOfSubstring('hello > world >\n\t foo \n\t', '>')
      );
    });
  });
});
