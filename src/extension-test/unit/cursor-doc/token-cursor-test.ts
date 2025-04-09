import * as expect from 'expect';
import { createStringCursor, LispTokenCursor } from '../../../cursor-doc/token-cursor';
import { docFromTextNotation, textAndSelection } from '../common/text-notation';

describe('Token Cursor', () => {
  describe('backwardWhitespace', () => {
    it('it moves past whitespace', () => {
      const a = docFromTextNotation('a •|c');
      const b = docFromTextNotation('a| •c');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardWhitespace();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('it moves past whitespace from inside symbol', () => {
      const a = docFromTextNotation('a •c|c');
      const b = docFromTextNotation('a| •cc');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardWhitespace();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
  });

  describe('forwardSexp', () => {
    it('moves from beginning to end of symbol', () => {
      const a = docFromTextNotation('(|c•#f)');
      const b = docFromTextNotation('(c|•#f)');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('forwardSexp with newline', () => {
      const a = docFromTextNotation('|(a\n(b))');
      const b = docFromTextNotation('(a\n(b))|');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('forwardSexp with newline (MS-Windows)', () => {
      const a = docFromTextNotation('|(a\r\n(b))');
      const b = docFromTextNotation('(a\r\n(b))|');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('moves from beginning to end of nested list ', () => {
      const a = docFromTextNotation('|(a(b(c•#f•(#b •[:f])•#z•1)))');
      const b = docFromTextNotation('(a(b(c•#f•(#b •[:f])•#z•1)))|');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Includes reader tag as part of a list form', () => {
      const a = docFromTextNotation('(c|•#f•(#b •[:f :b :z])•#z•1)');
      const b = docFromTextNotation('(c•#f•(#b •[:f :b :z])|•#z•1)');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Includes reader tag as part of a symbol', () => {
      const a = docFromTextNotation('(c•#f•(#b •[:f :b :z])|•#z•1)');
      const b = docFromTextNotation('(c•#f•(#b •[:f :b :z])•#z•1|)');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Does not move out of a list', () => {
      const a = docFromTextNotation('(c•#f•(#b •[:f :b :z])•#z•1|)');
      const b = docFromTextNotation('(c•#f•(#b •[:f :b :z])•#z•1|)');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Skip metadata if skipMetadata is true', () => {
      const a = docFromTextNotation('(a |^{:a 1} (= 1 1))');
      const b = docFromTextNotation('(a ^{:a 1} (= 1 1)|)');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp(true, true);
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Skip metadata and reader if skipMetadata is true', () => {
      const a = docFromTextNotation('(a |^{:a 1} #a (= 1 1))');
      const b = docFromTextNotation('(a ^{:a 1} #a (= 1 1)|)');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp(true, true);
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Skip reader and metadata if skipMetadata is true', () => {
      const a = docFromTextNotation('(a |#a ^{:a 1} (= 1 1))');
      const b = docFromTextNotation('(a #a ^{:a 1} (= 1 1)|)');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp(true, true);
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Skips multiple metadata maps if skipMetadata is true', () => {
      const a = docFromTextNotation('(a |^{:a 1} ^{:b 2} (= 1 1))');
      const b = docFromTextNotation('(a ^{:a 1} ^{:b 2} (= 1 1)|)');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp(true, true);
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Skips symbol shorthand for metadata if skipMetadata is true', () => {
      const a = docFromTextNotation('(a| ^String (= 1 1))');
      const b = docFromTextNotation('(a ^String (= 1 1)|)');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp(true, true);
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Skips keyword shorthand for metadata if skipMetadata is true', () => {
      const a = docFromTextNotation('(a| ^:hello (= 1 1))');
      const b = docFromTextNotation('(a ^:hello (= 1 1)|)');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp(true, true);
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Skips multiple keyword shorthands for metadata if skipMetadata is true', () => {
      const a = docFromTextNotation('(a| ^:hello ^:world (= 1 1))');
      const b = docFromTextNotation('(a ^:hello ^:world (= 1 1)|)');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp(true, true);
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Does not skip ignored forms if skipIgnoredForms is false', () => {
      const a = docFromTextNotation('(a| #_1 #_2 3)');
      const b = docFromTextNotation('(a #_|a #_2 3)');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp(true, true);
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Skip ignored forms if skipIgnoredForms is true', () => {
      const a = docFromTextNotation('(a| #_1 #_2 3)');
      const b = docFromTextNotation('(a #_1 #_2 3|)');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp(true, true, true);
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('should skip stacked ignored forms if skipIgnoredForms is true', () => {
      const a = docFromTextNotation('(a| #_ #_ 1 2 3)');
      const b = docFromTextNotation('(a #_ #_ 1 2 3|)');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp(true, true, true);
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    xit('Does not move past unbalanced top level form', () => {
      //TODO: Figure out why this doesn't work
      const d = docFromTextNotation('|(foo "bar"');
      const cursor: LispTokenCursor = d.getTokenCursor(d.selections[0].anchor);
      const offsetStart = cursor.offsetStart;
      cursor.forwardSexp();
      expect(cursor.offsetStart).toBe(offsetStart);
    });
  });

  describe('backwardSexp', () => {
    it('moves from end to beginning of symbol', () => {
      const a = docFromTextNotation('(a(b(c|•#f•(#b •[:f :b :z])•#z•1)))');
      const b = docFromTextNotation('(a(b(|c•#f•(#b •[:f :b :z])•#z•1)))');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('moves from end to beginning of nested list ', () => {
      const a = docFromTextNotation('(a(b(c•#f•(#b •[:f :b :z])•#z•1)))|');
      const b = docFromTextNotation('|(a(b(c•#f•(#b •[:f :b :z])•#z•1)))');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Includes reader tag as part of a list form', () => {
      const a = docFromTextNotation('(a(b(c•#f•(#b •[:f :b :z])|•#z•1)))');
      const b = docFromTextNotation('(a(b(c•|#f•(#b •[:f :b :z])•#z•1)))');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Includes reader tag as part of a symbol', () => {
      const a = docFromTextNotation('(a(b(c•#f•(#b •[:f :b :z])•#z•1|)))');
      const b = docFromTextNotation('(a(b(c•#f•(#b •[:f :b :z])•|#z•1)))');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Does not move out of a list', () => {
      const a = docFromTextNotation('(a(|b(c•#f•(#b •[:f :b :z])•#z•1)))');
      const b = docFromTextNotation('(a(|b(c•#f•(#b •[:f :b :z])•#z•1)))');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Skip metadata if skipMetadata is true', () => {
      const a = docFromTextNotation('(a ^{:a 1} (= 1 1)|)');
      const b = docFromTextNotation('(a |^{:a 1} (= 1 1))');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp(true, true);
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Treats metadata as part of the sexp if skipMetadata is true', () => {
      const a = docFromTextNotation('(a ^{:a 1}| (= 1 1))');
      const b = docFromTextNotation('(a |^{:a 1} (= 1 1))');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp(true, true);
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Skips multiple metadata maps if skipMetadata is true', () => {
      const a = docFromTextNotation('(a ^{:a 1} ^{:b 2} (= 1 1)|)');
      const b = docFromTextNotation('(a |^{:a 1} ^{:b 2} (= 1 1))');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp(true, true);
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Treats metadata and readers as part of the sexp if skipMetadata is true', () => {
      const a = docFromTextNotation('#bar •^baz•|[:a :b :c]•x');
      const b = docFromTextNotation('|#bar •^baz•[:a :b :c]•x');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp(true, true);
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Treats reader and metadata as part of the sexp if skipMetadata is true', () => {
      const a = docFromTextNotation('^bar •#baz•|[:a :b :c]•x');
      const b = docFromTextNotation('|^bar •#baz•[:a :b :c]•x');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp(true, true);
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Treats readers and metadata:s mixed as part of the sexp from behind the sexp if skipMetadata is true', () => {
      const a = docFromTextNotation('^d #c ^b •#a•[:a :b :c]|•x');
      const b = docFromTextNotation('|^d #c ^b •#a•[:a :b :c]•x');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp(true, true);
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Does not skip ignored forms if skipIgnoredForms', () => {
      const a = docFromTextNotation('(a #_1 #_2 |3)');
      const b = docFromTextNotation('(a #_a #_|2 3)');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp(true, true);
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Does not skip stacked ignored forms', () => {
      const a = docFromTextNotation('(a #_ #_ 1 2 |3)');
      const b = docFromTextNotation('(a #_ #_ 1 |2 3)');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp(true, true);
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
  });

  describe('downList', () => {
    it('Puts cursor to the right of the following open paren', () => {
      const a = docFromTextNotation('(a |(b 1))');
      const b = docFromTextNotation('(a (|b 1))');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.downList();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Puts cursor to the right of the following open curly brace:', () => {
      const a = docFromTextNotation('(a |{:b 1}))');
      const b = docFromTextNotation('(a {|:b 1}))');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.downList();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Puts cursor to the right of the following open bracket', () => {
      const a = docFromTextNotation('(a| [1 2]))');
      const b = docFromTextNotation('(a [|a 2]))');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.downList();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it(`Puts cursor to the right of the following opening quoted list`, () => {
      const a = docFromTextNotation(`(a| '(b 1))`);
      const b = docFromTextNotation(`(a '(|b 1))`);
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.downList();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Skips whitespace', () => {
      const a = docFromTextNotation('(a|•  (b 1))');
      const b = docFromTextNotation('(a•  (|b 1))');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.downList();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Does not skip metadata', () => {
      const a = docFromTextNotation('(a| ^{:x 1} (b 1))');
      const b = docFromTextNotation('(a ^{|:x 1} (b 1))');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.downList();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
  });

  describe('downListSkippingMeta', () => {
    it('Moves down, skipping metadata', () => {
      const a = docFromTextNotation('(|a #b ^{:x 1} (c 1))');
      const b = docFromTextNotation('(a #b ^{:x 1} (|c 1))');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.downListSkippingMeta();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Moves down when there is no metadata', () => {
      const a = docFromTextNotation('(|a #b (c 1))');
      const b = docFromTextNotation('(a #b (|c 1))');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.downListSkippingMeta();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
  });

  it('upList', () => {
    const a = docFromTextNotation('(a(b(c•#f•(#b •[:f :b :z])•#z•1|)))');
    const b = docFromTextNotation('(a(b(c•#f•(#b •[:f :b :z])•#z•1)|))');
    const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
    cursor.upList();
    expect(cursor.offsetStart).toBe(b.selections[0].anchor);
  });

  describe('forwardList', () => {
    it('Finds end of list', () => {
      const a = docFromTextNotation('(|foo (bar baz) [])');
      const b = docFromTextNotation('(foo (bar baz) []|)');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardList();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Finds end of list through readers and meta', () => {
      const a = docFromTextNotation('(|#a ^{:b c} #d (bar baz) [])');
      const b = docFromTextNotation('(#a ^{:b c} #d (bar baz) []|)');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardList();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Does not move at top level', () => {
      const a = docFromTextNotation('|foo (bar baz)');
      const b = docFromTextNotation('|foo (bar baz)');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardList();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Does not move at top level when unbalanced document from extra closings', () => {
      const a = docFromTextNotation('|foo (bar baz))');
      const b = docFromTextNotation('|foo (bar baz))');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardList();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Does not move at top level when unbalanced document from extra opens', () => {
      const a = docFromTextNotation('|foo ((bar baz)');
      const b = docFromTextNotation('|foo ((bar baz)');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardList();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Does not move when unbalanced from extra opens', () => {
      const a = docFromTextNotation('(|[');
      const b = docFromTextNotation('(|[');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardList();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Does not move when at end of list, returns true', () => {
      const a = docFromTextNotation('(|)');
      const b = docFromTextNotation('(|)');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.forwardList();
      expect(result).toBe(true);
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Finds the list end when unbalanced from extra closes outside the current list', () => {
      const a = docFromTextNotation('(|a #b []))');
      const b = docFromTextNotation('(a #b []|))');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardList();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
  });

  describe('backwardList', () => {
    it('Finds start of list', () => {
      const a = docFromTextNotation('(((c•(#b •[:f])•#z•|a)))');
      const b = docFromTextNotation('(((|c•(#b •[:f])•#z•1)))');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardList();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Finds start of list through readers', () => {
      const a = docFromTextNotation('(((c•#a• #f•(#b •[:f])•#z•|a)))');
      const b = docFromTextNotation('(((|c•#a• #f•(#b •[:f])•#z•1)))');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardList();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Finds start of list through metadata', () => {
      const a = docFromTextNotation('(((c•^{:a c} (#b •[:f])•#z•|a)))');
      const b = docFromTextNotation('(((|c•^{:a c} (#b •[:f])•#z•1)))');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardList();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Does not move at top level', () => {
      const a = docFromTextNotation('foo |(bar baz)');
      const b = docFromTextNotation('foo |(bar baz)');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardList();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Does not move when at start of unbalanced list', () => {
      // https://github.com/BetterThanTomorrow/calva/issues/1573
      // https://github.com/BetterThanTomorrow/calva/commit/d77359fcea16bc052ab829853d5711434330a375
      const a = docFromTextNotation('([|');
      const b = docFromTextNotation('([|');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.backwardList();
      expect(result).toBe(false);
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Does not move to start of an unbalanced list when outer list is also unbalanced', () => {
      // NB: This is a bit arbitrary, this test documents the current behaviour
      const a = docFromTextNotation('(let [a| a');
      const b = docFromTextNotation('(let [a| a');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.backwardList();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      expect(result).toBe(false);
    });
    it('Moves to start of an unbalanced list when outer list is balanced', () => {
      // NB: This is a bit arbitrary, this test documents the current behaviour
      const a = docFromTextNotation('(let [a| a)');
      const b = docFromTextNotation('(let [|a a)');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.backwardList();
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      expect(result).toBe(true);
    });
    it('Finds the list start when unbalanced from extra closes outside the current list', () => {
      const a = docFromTextNotation('([]|))');
      const b = docFromTextNotation('(|[]))');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.backwardList();
      expect(result).toBe(true);
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
  });

  describe('forwardListOfType', () => {
    it('Finds end of list', () => {
      const a = docFromTextNotation('([#{|c•(#b •[:f])•#z•1}])');
      const b = docFromTextNotation('([#{c•(#b •[:f])•#z•1}]|)');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.forwardListOfType(')');
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      expect(result).toBe(true);
    });
    it('Finds end of vector', () => {
      const a = docFromTextNotation('([(c•(#b| •[:f])•#z•1)])');
      const b = docFromTextNotation('([(c•(#b •[:f])•#z•1)|])');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.forwardListOfType(']');
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      expect(result).toBe(true);
    });
    it('Finds end of map', () => {
      const a = docFromTextNotation('({:a [(c•(#|b •[:f])•#z•|a)]})');
      const b = docFromTextNotation('({:a [(c•(#b •[:f])•#z•1)]|})');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.forwardListOfType('}');
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      expect(result).toBe(true);
    });
    it('Does not move when list is unbalanced from missing open', () => {
      const a = docFromTextNotation('|])');
      const b = docFromTextNotation('|])');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.forwardListOfType(')');
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      expect(result).toBe(false);
    });
    it('Does not move when list type is not found', () => {
      const a = docFromTextNotation('([|])');
      const b = docFromTextNotation('([|])');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.forwardListOfType('}');
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      expect(result).toBe(false);
    });
  });

  describe('backwardListOfType', () => {
    it('Finds start of list', () => {
      const a = docFromTextNotation('([#{c•(#b •[:f])•#z•|a}])');
      const b = docFromTextNotation('(|[#{c•(#b •[:f])•#z•1}])');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.backwardListOfType('(');
      expect(result).toBe(true);
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Finds start of vector', () => {
      const a = docFromTextNotation('([(c•(#b •[:f])•#z•|a)])');
      const b = docFromTextNotation('([|(c•(#b •[:f])•#z•1)])');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.backwardListOfType('[');
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      expect(result).toBe(true);
    });
    it('Finds start of map', () => {
      const a = docFromTextNotation('({:a [(c•(#b •[:f])•#z•|a)]})');
      const b = docFromTextNotation('({|:a [(c•(#b •[:f])•#z•1)]})');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.backwardListOfType('{');
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      expect(result).toBe(true);
    });
    it('Does not move when list type is unbalanced from missing close', () => {
      // This hung the structural editing in the real editor
      // https://github.com/BetterThanTomorrow/calva/issues/1573
      const a = docFromTextNotation('([|');
      const b = docFromTextNotation('([|');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.backwardListOfType('(');
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      expect(result).toBe(false);
    });
    it('Moves backward in unbalanced list when outer list is balanced', () => {
      // https://github.com/BetterThanTomorrow/calva/issues/1585
      const a = docFromTextNotation('(let [a|)');
      const b = docFromTextNotation('(let [|a)');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.backwardListOfType('[');
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      expect(result).toBe(true);
    });
    it('Moves backward in balanced list when inner list is unbalanced', () => {
      // This never completes in Calva v2.0.252
      // https://github.com/BetterThanTomorrow/calva/issues/1585
      const a = docFromTextNotation('(let [a|)');
      const b = docFromTextNotation('(|let [a)');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.backwardListOfType('(');
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      expect(result).toBe(true);
    });
    it('Does not move when list type is not found', () => {
      const a = docFromTextNotation('([|])');
      const b = docFromTextNotation('([|])');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.backwardListOfType('{');
      expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      expect(result).toBe(false);
    });
  });

  it('backwardUpList', () => {
    const a = docFromTextNotation('(a(b(c•#f•(#b •|[:f :b :z])•#z•1)))');
    const b = docFromTextNotation('(a(b(c•#f•|(#b •[:f :b :z])•#z•1)))');
    const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
    cursor.backwardUpList();
    expect(cursor.offsetStart).toBe(b.selections[0].anchor);
  });

  describe('Navigation in and around strings', () => {
    it('backwardList moves to start of string', () => {
      const a = docFromTextNotation('(str [] "", "foo" "f |  b  b"   "   f b b   " "\\"" \\")');
      const b = docFromTextNotation('(str [] "", "foo" "|f   b  b"   "   f b b   " "\\"" \\")');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardList();
      expect(cursor.offsetStart).toEqual(b.selections[0].anchor);
    });
    it('forwardList moves to end of string', () => {
      const a = docFromTextNotation('(str [] "", "foo" "f |  b  b"   "   f b b   " "\\"" \\")');
      const b = docFromTextNotation('(str [] "", "foo" "f   b  b|"   "   f b b   " "\\"" \\")');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardList();
      expect(cursor.offsetStart).toEqual(b.selections[0].anchor);
    });
    it('backwardSexpr inside string moves past quoted characters', () => {
      const a = docFromTextNotation('(str [] "foo \\"| bar")');
      const b = docFromTextNotation('(str [] "foo |\\" bar")');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp();
      expect(cursor.offsetStart).toEqual(b.selections[0].anchor);
    });
  });

  describe('The REPL prompt', () => {
    it('Backward sexp bypasses prompt', () => {
      const a = docFromTextNotation('foo•clj꞉foo꞉> |');
      const b = docFromTextNotation('|foo•clj꞉foo꞉> ');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp();
      expect(cursor.offsetStart).toEqual(b.selections[0].active);
    });
    it('Backward sexp not skipping comments bypasses prompt finding its start', () => {
      const a = docFromTextNotation('foo•clj꞉foo꞉> |');
      const b = docFromTextNotation('foo•|clj꞉foo꞉> ');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp(false);
      expect(cursor.offsetStart).toEqual(b.selections[0].active);
    });
  });

  describe('Current Form', () => {
    it('0: selects from within non-list form', () => {
      const a = docFromTextNotation('(a|aa (bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x');
      const b = docFromTextNotation('(|aaa| (bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toEqual(textAndSelection(b)[1]);
    });
    it('0: selects from within non-list form including reader tag', () => {
      const a = docFromTextNotation('(#a a|aa (foo bar)))');
      const b = docFromTextNotation('(|#a aaa| (foo bar)))');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toEqual(textAndSelection(b)[1]);
    });
    it('0: selects from within non-list form including multiple reader tags', () => {
      const a = docFromTextNotation('(#aa #a #b a|aa (foo bar)))');
      const b = docFromTextNotation('(|#aa #a #b aaa| (foo bar)))');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toEqual(textAndSelection(b)[1]);
    });
    it('0: selects from within non-list form including metadata', () => {
      const a = docFromTextNotation('(^aa #a a|aa (foo bar)))');
      const b = docFromTextNotation('(|^aa #a aaa| (foo bar)))');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toEqual(textAndSelection(b)[1]);
    });
    it('0: selects from within non-list form including readers and metadata', () => {
      const a = docFromTextNotation('(^aa #a a|aa (foo bar))');
      const b = docFromTextNotation('(|^aa #a aaa| (foo bar))');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toEqual(textAndSelection(b)[1]);
    });
    it('0: selects from within non-list form including metadata and readers', () => {
      const a = docFromTextNotation('(#a ^aa a|aa (foo bar))');
      const b = docFromTextNotation('(|#a ^aa aaa| (foo bar))');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toEqual(textAndSelection(b)[1]);
    });
    it('1: selects from adjacent when after form', () => {
      const a = docFromTextNotation('(aaa •x•#(a b c)|)•#baz•yyy•)');
      const b = docFromTextNotation('(aaa •x•|#(a b c)|)•#baz•yyy•)');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toEqual(textAndSelection(b)[1]);
    });
    it('1: selects from adjacent when after form, including reader tags', () => {
      const a = docFromTextNotation('(x• #a #b •#(a b c)|)•#baz•yyy•)');
      const b = docFromTextNotation('(x• |#a #b •#(a b c)|)•#baz•yyy•)');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toEqual(textAndSelection(b)[1]);
    });
    it('1: selects from adjacent when after form, including readers and meta data', () => {
      const a = docFromTextNotation('(x• ^a #b •#(a b c)|)•#baz•yyy•)');
      const b = docFromTextNotation('(x• |^a #b •#(a b c)|)•#baz•yyy•)');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toEqual(textAndSelection(b)[1]);
    });
    it('1: selects from adjacent when after form, including meta data and readers', () => {
      const a = docFromTextNotation('(x• #a ^b •#(a b c)|)•#baz•yyy•)');
      const b = docFromTextNotation('(x• |#a ^b •#(a b c)|)•#baz•yyy•)');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toEqual(textAndSelection(b)[1]);
    });
    it('2: selects from adjacent before form', () => {
      const a = docFromTextNotation('#bar •#baz•[:a :b :c]•x•|#(a b c)');
      const b = docFromTextNotation('#bar •#baz•[:a :b :c]•x•|#(a b c)|');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toEqual(textAndSelection(b)[1]);
    });
    it('2: selects from adjacent before form, including reader tags', () => {
      const a = docFromTextNotation('|#bar •#baz•[:a :b :c]•x');
      const b = docFromTextNotation('|#bar •#baz•[:a :b :c]|•x');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toEqual(textAndSelection(b)[1]);
    });
    it('2: selects from adjacent before form, including meta data', () => {
      const a = docFromTextNotation('|^bar •[:a :b :c]•x');
      const b = docFromTextNotation('|^bar •[:a :b :c]|•x');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toEqual(textAndSelection(b)[1]);
    });
    it('2: selects from adjacent before form, including meta data and reader', () => {
      const a = docFromTextNotation('|^bar •#baz•[:a :b :c]•x');
      const b = docFromTextNotation('|^bar •#baz•[:a :b :c]|•x');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toEqual(textAndSelection(b)[1]);
    });
    it('2: selects from adjacent before form, including preceding reader and meta data', () => {
      const a = docFromTextNotation('^bar •#baz•|[:a :b :c]•x');
      const b = docFromTextNotation('|^bar •#baz•[:a :b :c]|•x');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toEqual(textAndSelection(b)[1]);
    });
    it('2: selects from adjacent before form, including preceding meta data and reader', () => {
      const a = docFromTextNotation('#bar •^baz•|[:a :b :c]•x');
      const b = docFromTextNotation('|#bar •^baz•[:a :b :c]|•x');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toEqual(textAndSelection(b)[1]);
    });
    it('2: selects from adjacent before form, or in readers', () => {
      const a = docFromTextNotation('ccc •#foo•|•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy');
      const b = docFromTextNotation('ccc •|#foo••(#bar •#baz•[:a :b :c]•x•#(a b c))|•#baz•yyy');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toEqual(textAndSelection(b)[1]);
    });
    it('2: selects from adjacent before a form with reader tags', () => {
      const a = docFromTextNotation('#bar |•#baz•[:a :b :c]•x');
      const b = docFromTextNotation('|#bar •#baz•[:a :b :c]|•x');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toEqual(textAndSelection(b)[1]);
    });
    it('3: selects previous form, if on the same line', () => {
      const a = docFromTextNotation('z z  | •foo•   •   bar');
      const b = docFromTextNotation('z |z|   •foo•   •   bar');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toEqual(textAndSelection(b)[1]);
    });
    it('4: selects next form, if on the same line', () => {
      const a = docFromTextNotation('yyy•|   z z z   •foo•   •   bar');
      const b = docFromTextNotation('yyy•   |z| z z   •foo•   •   bar');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toEqual(textAndSelection(b)[1]);
    });
    it('5: selects previous form, if any', () => {
      const a = docFromTextNotation('yyy•   z z z   •foo•   |•   bar');
      const b = docFromTextNotation('yyy•   z z z   •|foo|•   •   bar');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toEqual(textAndSelection(b)[1]);
    });
    it('5: selects previous form, if any, when next form has metadata', () => {
      const a = docFromTextNotation('z•foo•|•^{:a b}•bar');
      const b = docFromTextNotation('z•|foo|••^{:a b}•bar');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toEqual(textAndSelection(b)[1]);
    });
    it('6: selects next form, if any', () => {
      const a = docFromTextNotation(' | •  (foo {:a b})•(c)');
      const b = docFromTextNotation('  •  |(foo {:a b})|•(c)');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toEqual(textAndSelection(b)[1]);
    });
    it('7: selects enclosing form, if any', () => {
      const a = docFromTextNotation('(|)  •  (foo {:a b})•(c)');
      const b = docFromTextNotation('|()|  •  (foo {:a b})•(c)');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toEqual(textAndSelection(b)[1]);
    });
    it('2: selects anonymous function when cursor is before #', () => {
      const a = docFromTextNotation('(map |#(println %) [1 2])');
      const b = docFromTextNotation('(map |#(println %)| [1 2])');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toEqual(textAndSelection(b)[1]);
    });
    it('2: selects anonymous function when cursor is after # and before (', () => {
      const a = docFromTextNotation('(map #|(println %) [1 2])');
      const b = docFromTextNotation('(map |#(println %)| [1 2])');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toEqual(textAndSelection(b)[1]);
    });
    it('8: does not croak on unbalance', () => {
      // This hangs the structural editing in the real editor
      // https://github.com/BetterThanTomorrow/calva/issues/1573
      const a = docFromTextNotation('([|');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toBeUndefined();
    });
  });

  describe('Top Level Form', () => {
    it('Finds range when nested down some forms', () => {
      const a = docFromTextNotation(
        'aaa (bbb (ccc •#foo•(#bar •#baz•[:a :b| :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)) (ddd eee)'
      );
      const b = docFromTextNotation(
        'aaa |(bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar))| (ddd eee)'
      );
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].active);
      expect(cursor.rangeForDefun(a.selections[0].active)).toEqual(textAndSelection(b)[1]);
    });
    it('Finds range when in current form is top level', () => {
      const a = docFromTextNotation(
        'aaa (bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)) |(ddd eee)'
      );
      const b = docFromTextNotation(
        'aaa (bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)) |(ddd eee)|'
      );
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].active);
      expect(cursor.rangeForDefun(a.selections[0].active)).toEqual(textAndSelection(b)[1]);
    });
    it('Finds range when in ”solid” top level form', () => {
      const a = docFromTextNotation(
        'a|aa (bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)) (ddd eee)'
      );
      const b = docFromTextNotation(
        '|aaa| (bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)) (ddd eee)'
      );
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].active);
      expect(cursor.rangeForDefun(a.selections[0].active)).toEqual(textAndSelection(b)[1]);
    });
    it('Finds something when there is unbalance', () => {
      const a = docFromTextNotation(
        '(ns xxx)•(def xxx|•{()"#"\\$" #"(?!\\w)"))))))))))))))))))))))))))))))))))))))))'
      );
      const b = docFromTextNotation(
        '(ns xxx)•(def xxx•|{()"#"\\$" #"(?!\\w)"))))))))))))))))))))))))))))))))))))))))|'
      );
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].active);
      expect(cursor.rangeForDefun(a.selections[0].active)).toEqual(textAndSelection(b)[1]);
    });
    // https://github.com/BetterThanTomorrow/calva/issues/2655
    it('Does not include ignore marker', () => {
      const a = docFromTextNotation('a #_ [b (c|)] [d]');
      const b = docFromTextNotation('a #_ |[b (c)]| [d]');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].active);
      expect(cursor.rangeForDefun(a.selections[0].active)).toEqual(textAndSelection(b)[1]);
    });
    describe('Rich Comment Form top level context', () => {
      it('Finds range for a top level form inside a comment', () => {
        const a = docFromTextNotation('aaa (comment [bbb cc|c]  ddd)');
        const b = docFromTextNotation('aaa (comment |[bbb ccc]|  ddd)');
        const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expect(cursor.rangeForDefun(a.selections[0].active)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds range for a top level map inside a comment', () => {
        const a = docFromTextNotation('aaa (comment {bbb cc|c}  ddd)');
        const b = docFromTextNotation('aaa (comment |{bbb ccc}|  ddd)');
        const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expect(cursor.rangeForDefun(a.selections[0].active)).toEqual(textAndSelection(b)[1]);
      });
      // https://github.com/BetterThanTomorrow/calva/issues/2290
      describe('Rich Comment Form top level context from inside form', () => {
        it('Finds range for a top level function call inside a comment from inside a string', () => {
          const a = docFromTextNotation('aaa (comment (bbb "cc|c")  ddd)');
          const b = docFromTextNotation('aaa (comment |(bbb "ccc")|  ddd)');
          const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].active);
          expect(cursor.rangeForDefun(a.selections[0].active)).toEqual(textAndSelection(b)[1]);
        });
        it('Finds range for a top level shortcut lambda function inside a comment from inside a string', () => {
          const a = docFromTextNotation('aaa (comment #(bbb "cc|c")  ddd)');
          const b = docFromTextNotation('aaa (comment |#(bbb "ccc")|  ddd)');
          const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].active);
          expect(cursor.rangeForDefun(a.selections[0].active)).toEqual(textAndSelection(b)[1]);
        });
        it('Finds range for a top level quoted list inside a comment from inside a string', () => {
          const a = docFromTextNotation(`aaa (comment '(bbb "cc|c")  ddd)`);
          const b = docFromTextNotation(`aaa (comment |'(bbb "ccc")|  ddd)`);
          const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].active);
          expect(cursor.rangeForDefun(a.selections[0].active)).toEqual(textAndSelection(b)[1]);
        });
        it('Finds range for a top level map inside a comment from inside a string', () => {
          const a = docFromTextNotation('aaa (comment {bbb "cc|c"}  ddd)');
          const b = docFromTextNotation('aaa (comment |{bbb "ccc"}|  ddd)');
          const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].active);
          expect(cursor.rangeForDefun(a.selections[0].active)).toEqual(textAndSelection(b)[1]);
        });
        it('Finds range for a top level map inside a comment from inside a form', () => {
          const a = docFromTextNotation('aaa (comment {bbb [cc|c]}  ddd)');
          const b = docFromTextNotation('aaa (comment |{bbb [ccc]}|  ddd)');
          const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].active);
          expect(cursor.rangeForDefun(a.selections[0].active)).toEqual(textAndSelection(b)[1]);
        });
        it('Finds range for a top level set inside a comment from inside a string', () => {
          const a = docFromTextNotation('aaa (comment #{bbb "cc|c"}  ddd)');
          const b = docFromTextNotation('aaa (comment |#{bbb "ccc"}|  ddd)');
          const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].active);
          expect(cursor.rangeForDefun(a.selections[0].active)).toEqual(textAndSelection(b)[1]);
        });
        it('Finds range for a top level vector inside a comment from inside a string', () => {
          const a = docFromTextNotation('aaa (comment [bbb "cc|c"]  ddd)');
          const b = docFromTextNotation('aaa (comment |[bbb "ccc"]|  ddd)');
          const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].active);
          expect(cursor.rangeForDefun(a.selections[0].active)).toEqual(textAndSelection(b)[1]);
        });
      });
      it('Finds range for a top level form inside a comment inside a form', () => {
        const a = docFromTextNotation('a (b (comment [c |d] e))');
        const b = docFromTextNotation('a (b (comment |[c d]| e))');
        const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expect(cursor.rangeForDefun(a.selections[0].active)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds top level comment range if comment special treatment is disabled', () => {
        const a = docFromTextNotation(
          'aaa (comment (ccc •#foo•(#bar •#baz•[:a :b| :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)) (ddd eee)'
        );
        const b = docFromTextNotation(
          'aaa |(comment (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar))| (ddd eee)'
        );
        const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expect(cursor.rangeForDefun(a.selections[0].active, false)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds comment range for empty comment form', () => {
        // Unimportant use case, just documenting how it behaves
        const a = docFromTextNotation('aaa (comment |  ) bbb');
        const b = docFromTextNotation('aaa (|comment|   ) bbb');
        const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expect(cursor.rangeForDefun(a.selections[0].active)).toEqual(textAndSelection(b)[1]);
      });
      it('Does not find comment range when comments are nested', () => {
        const a = docFromTextNotation('aaa (comment (comment [bbb ccc] | ddd))');
        const b = docFromTextNotation('aaa (comment (comment |[bbb ccc]|  ddd))');
        const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expect(cursor.rangeForDefun(a.selections[0].active)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds comment range when current form is top level comment form', () => {
        const a = docFromTextNotation(
          'aaa (bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)) |(comment eee)'
        );
        const b = docFromTextNotation(
          'aaa (bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)) |(comment eee)|'
        );
        const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expect(cursor.rangeForDefun(a.selections[0].active)).toEqual(textAndSelection(b)[1]);
      });
      it('Includes reader tag', () => {
        const a = docFromTextNotation('aaa (comment #r [bbb ccc|]  ddd)');
        const b = docFromTextNotation('aaa (comment |#r [bbb ccc]|  ddd)');
        const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expect(cursor.rangeForDefun(a.selections[0].active)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds the preceding range when cursor is between to forms on the same line', () => {
        const a = docFromTextNotation('aaa (comment [bbb ccc] | ddd)');
        const b = docFromTextNotation('aaa (comment |[bbb ccc]|  ddd)');
        const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expect(cursor.rangeForDefun(a.selections[0].active)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds the succeeding range when cursor is at the start of the line', () => {
        const a = docFromTextNotation('aaa (comment [bbb ccc]• | ddd)');
        const b = docFromTextNotation('aaa (comment [bbb ccc]•  |ddd|)');
        const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expect(cursor.rangeForDefun(a.selections[0].active)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds the preceding comment symbol range when cursor is between that and something else on the same line', () => {
        // This is a bit funny, but is not an important use case
        const a = docFromTextNotation('aaa (comment  | [bbb ccc]  ddd)');
        const b = docFromTextNotation('aaa (|comment|   [bbb ccc]  ddd)');
        const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expect(cursor.rangeForDefun(a.selections[0].active)).toEqual(textAndSelection(b)[1]);
      });
      it('Can find the comment range for a top level form inside a comment', () => {
        const a = docFromTextNotation(
          'aaa (comment (ccc •#foo•(#bar •#baz•[:a :b| :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)) (ddd eee)'
        );
        const b = docFromTextNotation(
          'aaa |(comment (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar))| (ddd eee)'
        );
        const cursor: LispTokenCursor = a.getTokenCursor(0);
        expect(cursor.rangeForDefun(a.selections[0].anchor, false)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds closest form inside multiple nested comments', () => {
        const a = docFromTextNotation('aaa (comment (comment [bbb ccc] | ddd))');
        const b = docFromTextNotation('aaa (comment (comment |[bbb ccc]|  ddd))');
        const cursor: LispTokenCursor = a.getTokenCursor(0);
        expect(cursor.rangeForDefun(a.selections[0].anchor)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds the preceding range when cursor is between two forms on the same line', () => {
        const a = docFromTextNotation('aaa (comment [bbb ccc] | ddd)');
        const b = docFromTextNotation('aaa (comment |[bbb ccc]|  ddd)');
        const cursor: LispTokenCursor = a.getTokenCursor(0);
        expect(cursor.rangeForDefun(a.selections[0].anchor)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds top level form when deref in comment', () => {
        const a = docFromTextNotation('(comment @(foo [bar|]))');
        const b = docFromTextNotation('(comment |@(foo [bar])|)');
        const cursor: LispTokenCursor = a.getTokenCursor(0);
        expect(cursor.rangeForDefun(a.selections[0].anchor)).toEqual(textAndSelection(b)[1]);
      });
      // https://github.com/BetterThanTomorrow/calva/issues/2655
      it('Does not include ignore marker', () => {
        const a = docFromTextNotation('aaa (comment #_ [bbb ccc|]  ddd)');
        const b = docFromTextNotation('aaa (comment #_ |[bbb ccc]|  ddd)');
        const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expect(cursor.rangeForDefun(a.selections[0].active)).toEqual(textAndSelection(b)[1]);
      });
    });
  });

  describe('Utilities', () => {
    describe('getFunctionName', () => {
      it('Finds function name in the current list', () => {
        const a = docFromTextNotation('(foo [|])');
        const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
        expect(cursor.getFunctionName()).toEqual('foo');
      });
      it('Does not croak finding function name in unbalance', () => {
        // This hung the structural editing in the real editor
        // https://github.com/BetterThanTomorrow/calva/issues/1573
        const a = docFromTextNotation('([|');
        const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
        expect(cursor.getFunctionName()).toBeUndefined();
      });
    });
    describe('createStringCursor', () => {
      it('Ranges account for newline', () => {
        const cursor = createStringCursor('(a\n(b))');
        const topLevelRanges = cursor.rangesForTopLevelForms().flat();
        expect(topLevelRanges).toEqual([0, 7]);
      });
      it('Ranges account for newline (MS-Windows)', () => {
        const cursor = createStringCursor('(a\r\n(b))');
        const topLevelRanges = cursor.rangesForTopLevelForms().flat();
        expect(topLevelRanges).toEqual([0, 8]);
      });
    });
    describe('atTopLevel', () => {
      it('Returns true when at top level', () => {
        const a = docFromTextNotation('(foo []) |(bar :baz)');
        const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expect(cursor.atTopLevel()).toEqual(true);
      });
      it('Returns true when at top level in rich comment if instructed so', () => {
        const a = docFromTextNotation('( comment (foo []) |(bar :baz))');
        const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expect(cursor.atTopLevel(true)).toEqual(true);
      });
      it('Returns true when at a top level map in rich comment if instructed so', () => {
        const a = docFromTextNotation('( comment (foo []) |{bar :baz})');
        const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expect(cursor.atTopLevel(true)).toEqual(true);
      });
      // TODO: Figure out if this should be how it works
      // Related to: https://github.com/BetterThanTomorrow/calva/issues/2109
      it('Returns true when at top level in rich comment if instructed so, even if comment is not at top level', () => {
        const a = docFromTextNotation('(a ( comment (foo []) |(bar :baz)))');
        const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expect(cursor.atTopLevel(true)).toEqual(true);
      });
      it('Returns true when at a top level map in rich comment if instructed so, even if comment is not at top level', () => {
        const a = docFromTextNotation('(a ( comment (foo []) |{bar :baz}))');
        const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expect(cursor.atTopLevel(true)).toEqual(true);
      });
      it('Returns false when at top level in rich comment if not instructed to treat it so', () => {
        const a = docFromTextNotation('( comment (foo []) |(bar :baz))');
        const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expect(cursor.atTopLevel()).toEqual(false);
      });
      it('Returns false when not at top level', () => {
        const a = docFromTextNotation('(foo |[])');
        const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expect(cursor.atTopLevel()).toEqual(false);
      });
    });

    describe('docIsBalanced', () => {
      it('Reports balance for balanced structure', () => {
        const doc = docFromTextNotation('(a)•|(b)');
        const cursor: LispTokenCursor = doc.getTokenCursor(doc.selections[0].active);
        expect(cursor.docIsBalanced()).toBe(true);
      });
      it('Detects unbalance when lacking opening brackets', () => {
        const doc = docFromTextNotation('(a)•|(b))');
        const cursor: LispTokenCursor = doc.getTokenCursor(doc.selections[0].active);
        expect(cursor.docIsBalanced()).toBe(false);
      });
      // TODO: Fix this
      xit('Detects unbalance when lacking closing brackets', () => {
        const doc = docFromTextNotation('(a)•|(b');
        const cursor: LispTokenCursor = doc.getTokenCursor(doc.selections[0].active);
        expect(cursor.docIsBalanced()).toBe(false);
      });
      // TODO: Fix this too
      xit('Detects unbalance when lacking man closing brackets', () => {
        const doc = docFromTextNotation('(a)•|([{((((b)');
        const cursor: LispTokenCursor = doc.getTokenCursor(doc.selections[0].active);
        expect(cursor.docIsBalanced()).toBe(false);
      });
    });

    describe('backwardFunction', () => {
      it('Finds current function start', () => {
        const a = docFromTextNotation('(a b |c)');
        const b = docFromTextNotation('(|a b c)');
        const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
        expect(cursor.backwardFunction()).toBe(true);
        expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      });
      it('Finds current function start when nested', () => {
        const a = docFromTextNotation('(a b (c d|))');
        const b = docFromTextNotation('(a b (|c d))');
        const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
        expect(cursor.backwardFunction()).toBe(true);
        expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      });
      it('Finds current function start when nested and inside non-function', () => {
        const a = docFromTextNotation('(a b (c d [e f|]))');
        const b = docFromTextNotation('(a b (|c d [e f]))');
        const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
        expect(cursor.backwardFunction()).toBe(true);
        expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      });
      it('Finds current function start when nested in rich comment', () => {
        const a = docFromTextNotation('(comment a b (c d|))');
        const b = docFromTextNotation('(comment a b (|c d))');
        const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
        expect(cursor.backwardFunction()).toBe(true);
        expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      });
      it('Finds parent function start', () => {
        const a = docFromTextNotation('(a b (c d|))');
        const b = docFromTextNotation('(|a b (c d))');
        const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
        expect(cursor.backwardFunction(1)).toBe(true);
        expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      });
    });
  });

  describe('Location State', () => {
    it('Knows when inside string', () => {
      const doc = docFromTextNotation('(str [] "", "foo" "f   b  b"   "   f b b   " "\\"" \\")');
      const withinEmpty = doc.getTokenCursor(9);
      expect(withinEmpty.withinString()).toBe(true);
      const adjacentOutsideLeft = doc.getTokenCursor(8);
      expect(adjacentOutsideLeft.withinString()).toBe(false);
      const adjacentOutsideRight = doc.getTokenCursor(10);
      expect(adjacentOutsideRight.withinString()).toBe(false);
      const noStringWS = doc.getTokenCursor(11);
      expect(noStringWS.withinString()).toBe(false);
      const leftOfFirstWord = doc.getTokenCursor(13);
      expect(leftOfFirstWord.withinString()).toBe(true);
      const rightOfLastWord = doc.getTokenCursor(16);
      expect(rightOfLastWord.withinString()).toBe(true);
      const inWord = doc.getTokenCursor(14);
      expect(inWord.withinString()).toBe(true);
      const spaceBetweenWords = doc.getTokenCursor(21);
      expect(spaceBetweenWords.withinString()).toBe(true);
      const spaceBeforeFirstWord = doc.getTokenCursor(33);
      expect(spaceBeforeFirstWord.withinString()).toBe(true);
      const spaceAfterLastWord = doc.getTokenCursor(41);
      expect(spaceAfterLastWord.withinString()).toBe(true);
      const beforeQuotedStringQuote = doc.getTokenCursor(46);
      expect(beforeQuotedStringQuote.withinString()).toBe(true);
      const inQuotedStringQuote = doc.getTokenCursor(47);
      expect(inQuotedStringQuote.withinString()).toBe(true);
      const afterQuotedStringQuote = doc.getTokenCursor(48);
      expect(afterQuotedStringQuote.withinString()).toBe(true);
      const beforeLiteralQuote = doc.getTokenCursor(50);
      expect(beforeLiteralQuote.withinString()).toBe(false);
      const inLiteralQuote = doc.getTokenCursor(51);
      expect(inLiteralQuote.withinString()).toBe(false);
      const afterLiteralQuote = doc.getTokenCursor(52);
      expect(afterLiteralQuote.withinString()).toBe(false);
    });
  });
});
