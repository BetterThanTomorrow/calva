import * as expect from 'expect';
import {
  keywordize,
  unKeywordize,
  getIndexAfterLastNonWhitespace,
  getTextAfterLastOccurrenceOfSubstring,
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
