import { expect } from 'chai';
import { keywordize, unKeywordize, getIndexAfterLastNonWhitespace, getTextAfterLastOccurrenceOfSubstring } from '../../../util/string';


describe('string', () => {
  describe('keywordize', function() {
    it('keywordizes non-keywords', function() {
      expect(":test").equal(keywordize("test"));
    }); 
    it('leaves keywords alone', function() {
      expect(":test").equal(keywordize(":test"));
    }); 
  });
  
  describe('unKeywordize', function() {
    it('un-keywordizes keywords', function() {
      expect("test").equal(unKeywordize(":test"));
    }); 
    it('leaves non-keywords alone', function() {
      expect("test").equal(unKeywordize("test"));
    }); 
  });

  describe('getIndexAfterLastNonWhitespace', () => {
    it('returns correct index of end of string', () => {
      expect(3).equal(getIndexAfterLastNonWhitespace('123'));
    })
    it('ignores whitespace at end of string', () => {
      expect(1).equal(getIndexAfterLastNonWhitespace('> '));
    });
    it('ignores tab characters at end of string', () => {
      expect(1).equal(getIndexAfterLastNonWhitespace('>\t\t'));
    });
    it('ignores eol characters at end of string', () => {
      expect(1).equal(getIndexAfterLastNonWhitespace('>\n\r\n'));
    });
  });

  describe('getTextAfterLastOccurrenceOfSubstring', () => {
    it('returns null if substring does not exist', () => {
      expect(null).equal(getTextAfterLastOccurrenceOfSubstring('hello world', '123'));
    });
    it('returns text after last occurrence of substring', () => {
      expect('foo').equal(getTextAfterLastOccurrenceOfSubstring('hello > world\nprompt >foo', '>'));
    });
    it('returns text after last occurrenc of substring without trimming whitespace or eol characters', () => {
      expect('\n\t foo \n\t').equal(getTextAfterLastOccurrenceOfSubstring('hello > world >\n\t foo \n\t', '>'));
    });
  });
});