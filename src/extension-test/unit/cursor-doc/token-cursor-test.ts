import * as expectLib from 'expect';
import * as tokenCursor from '../../../cursor-doc/token-cursor';
import * as textNotation from '../common/text-notation';

describe('Token Cursor', () => {
  describe('backwardWhitespace', () => {
    it('it moves past whitespace', () => {
      const a = textNotation.docFromTextNotation('a •|c');
      const b = textNotation.docFromTextNotation('a| •c');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardWhitespace();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('it moves past whitespace from inside symbol', () => {
      const a = textNotation.docFromTextNotation('a •c|c');
      const b = textNotation.docFromTextNotation('a| •cc');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardWhitespace();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
  });

  describe('forwardSexp', () => {
    it('moves from beginning to end of symbol', () => {
      const a = textNotation.docFromTextNotation('(|c•#f)');
      const b = textNotation.docFromTextNotation('(c|•#f)');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('forwardSexp with newline', () => {
      const a = textNotation.docFromTextNotation('|(a\n(b))');
      const b = textNotation.docFromTextNotation('(a\n(b))|');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('forwardSexp with newline (MS-Windows)', () => {
      const a = textNotation.docFromTextNotation('|(a\r\n(b))');
      const b = textNotation.docFromTextNotation('(a\r\n(b))|');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('moves from beginning to end of nested list ', () => {
      const a = textNotation.docFromTextNotation('|(a(b(c•#f•(#b •[:f])•#z•1)))');
      const b = textNotation.docFromTextNotation('(a(b(c•#f•(#b •[:f])•#z•1)))|');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Includes reader tag as part of a list form', () => {
      const a = textNotation.docFromTextNotation('(c|•#f•(#b •[:f :b :z])•#z•1)');
      const b = textNotation.docFromTextNotation('(c•#f•(#b •[:f :b :z])|•#z•1)');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Includes reader tag as part of a symbol', () => {
      const a = textNotation.docFromTextNotation('(c•#f•(#b •[:f :b :z])|•#z•1)');
      const b = textNotation.docFromTextNotation('(c•#f•(#b •[:f :b :z])•#z•1|)');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Does not move out of a list', () => {
      const a = textNotation.docFromTextNotation('(c•#f•(#b •[:f :b :z])•#z•1|)');
      const b = textNotation.docFromTextNotation('(c•#f•(#b •[:f :b :z])•#z•1|)');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Skip metadata if skipMetadata is true', () => {
      const a = textNotation.docFromTextNotation('(a |^{:a 1} (= 1 1))');
      const b = textNotation.docFromTextNotation('(a ^{:a 1} (= 1 1)|)');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp(true, true);
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Skip metadata and reader if skipMetadata is true', () => {
      const a = textNotation.docFromTextNotation('(a |^{:a 1} #a (= 1 1))');
      const b = textNotation.docFromTextNotation('(a ^{:a 1} #a (= 1 1)|)');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp(true, true);
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Skip reader and metadata if skipMetadata is true', () => {
      const a = textNotation.docFromTextNotation('(a |#a ^{:a 1} (= 1 1))');
      const b = textNotation.docFromTextNotation('(a #a ^{:a 1} (= 1 1)|)');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp(true, true);
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Skips multiple metadata maps if skipMetadata is true', () => {
      const a = textNotation.docFromTextNotation('(a |^{:a 1} ^{:b 2} (= 1 1))');
      const b = textNotation.docFromTextNotation('(a ^{:a 1} ^{:b 2} (= 1 1)|)');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp(true, true);
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Skips symbol shorthand for metadata if skipMetadata is true', () => {
      const a = textNotation.docFromTextNotation('(a| ^String (= 1 1))');
      const b = textNotation.docFromTextNotation('(a ^String (= 1 1)|)');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp(true, true);
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Skips keyword shorthand for metadata if skipMetadata is true', () => {
      const a = textNotation.docFromTextNotation('(a| ^:hello (= 1 1))');
      const b = textNotation.docFromTextNotation('(a ^:hello (= 1 1)|)');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp(true, true);
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Skips multiple keyword shorthands for metadata if skipMetadata is true', () => {
      const a = textNotation.docFromTextNotation('(a| ^:hello ^:world (= 1 1))');
      const b = textNotation.docFromTextNotation('(a ^:hello ^:world (= 1 1)|)');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp(true, true);
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Does not skip ignored forms if skipIgnoredForms is false', () => {
      const a = textNotation.docFromTextNotation('(a| #_1 #_2 3)');
      const b = textNotation.docFromTextNotation('(a #_1| #_2 3)');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp(true, true);
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Skip ignored forms if skipIgnoredForms is true', () => {
      const a = textNotation.docFromTextNotation('(a| #_1 #_2 3)');
      const b = textNotation.docFromTextNotation('(a #_1 #_2 3|)');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp(true, true, true);
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('should skip stacked ignored forms if skipIgnoredForms is true', () => {
      const a = textNotation.docFromTextNotation('(a| #_ #_ 1 2 3)');
      const b = textNotation.docFromTextNotation('(a #_ #_ 1 2 3|)');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardSexp(true, true, true);
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    xit('Does not move past unbalanced top level form', () => {
      //TODO: Figure out why this doesn't work
      const d = textNotation.docFromTextNotation('|(foo "bar"');
      const cursor: tokenCursor.LispTokenCursor = d.getTokenCursor(d.selections[0].anchor);
      const offsetStart = cursor.offsetStart;
      cursor.forwardSexp();
      expectLib.expect(cursor.offsetStart).toBe(offsetStart);
    });
  });

  describe('backwardSexp', () => {
    it('moves from end to beginning of symbol', () => {
      const a = textNotation.docFromTextNotation('(a(b(c|•#f•(#b •[:f :b :z])•#z•1)))');
      const b = textNotation.docFromTextNotation('(a(b(|c•#f•(#b •[:f :b :z])•#z•1)))');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('moves from end to beginning of nested list ', () => {
      const a = textNotation.docFromTextNotation('(a(b(c•#f•(#b •[:f :b :z])•#z•1)))|');
      const b = textNotation.docFromTextNotation('|(a(b(c•#f•(#b •[:f :b :z])•#z•1)))');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Includes reader tag as part of a list form', () => {
      const a = textNotation.docFromTextNotation('(a(b(c•#f•(#b •[:f :b :z])|•#z•1)))');
      const b = textNotation.docFromTextNotation('(a(b(c•|#f•(#b •[:f :b :z])•#z•1)))');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Includes reader tag as part of a symbol', () => {
      const a = textNotation.docFromTextNotation('(a(b(c•#f•(#b •[:f :b :z])•#z•1|)))');
      const b = textNotation.docFromTextNotation('(a(b(c•#f•(#b •[:f :b :z])•|#z•1)))');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Does not move out of a list', () => {
      const a = textNotation.docFromTextNotation('(a(|b(c•#f•(#b •[:f :b :z])•#z•1)))');
      const b = textNotation.docFromTextNotation('(a(|b(c•#f•(#b •[:f :b :z])•#z•1)))');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Skip metadata if skipMetadata is true', () => {
      const a = textNotation.docFromTextNotation('(a ^{:a 1} (= 1 1)|)');
      const b = textNotation.docFromTextNotation('(a |^{:a 1} (= 1 1))');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp(true, true);
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Treats metadata as part of the sexp if skipMetadata is true', () => {
      const a = textNotation.docFromTextNotation('(a ^{:a 1}| (= 1 1))');
      const b = textNotation.docFromTextNotation('(a |^{:a 1} (= 1 1))');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp(true, true);
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Skips multiple metadata maps if skipMetadata is true', () => {
      const a = textNotation.docFromTextNotation('(a ^{:a 1} ^{:b 2} (= 1 1)|)');
      const b = textNotation.docFromTextNotation('(a |^{:a 1} ^{:b 2} (= 1 1))');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp(true, true);
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Treats metadata and readers as part of the sexp if skipMetadata is true', () => {
      const a = textNotation.docFromTextNotation('#bar •^baz•|[:a :b :c]•x');
      const b = textNotation.docFromTextNotation('|#bar •^baz•[:a :b :c]•x');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp(true, true);
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Treats reader and metadata as part of the sexp if skipMetadata is true', () => {
      const a = textNotation.docFromTextNotation('^bar •#baz•|[:a :b :c]•x');
      const b = textNotation.docFromTextNotation('|^bar •#baz•[:a :b :c]•x');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp(true, true);
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Treats readers and metadata:s mixed as part of the sexp from behind the sexp if skipMetadata is true', () => {
      const a = textNotation.docFromTextNotation('^d #c ^b •#a•[:a :b :c]|•x');
      const b = textNotation.docFromTextNotation('|^d #c ^b •#a•[:a :b :c]•x');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp(true, true);
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Does not skip ignored forms if skipIgnoredForms', () => {
      const a = textNotation.docFromTextNotation('(a #_1 #_2 |3)');
      const b = textNotation.docFromTextNotation('(a #_a #_|2 3)');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp(true, true);
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Does not skip stacked ignored forms', () => {
      const a = textNotation.docFromTextNotation('(a #_ #_ 1 2 |3)');
      const b = textNotation.docFromTextNotation('(a #_ #_ 1 |2 3)');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp(true, true);
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
  });

  describe('downList', () => {
    it('Puts cursor to the right of the following open paren', () => {
      const a = textNotation.docFromTextNotation('(a |(b 1))');
      const b = textNotation.docFromTextNotation('(a (|b 1))');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.downList();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Puts cursor to the right of the following open curly brace:', () => {
      const a = textNotation.docFromTextNotation('(a |{:b 1}))');
      const b = textNotation.docFromTextNotation('(a {|:b 1}))');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.downList();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Puts cursor to the right of the following open bracket', () => {
      const a = textNotation.docFromTextNotation('(a| [1 2]))');
      const b = textNotation.docFromTextNotation('(a [|a 2]))');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.downList();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it(`Puts cursor to the right of the following opening quoted list`, () => {
      const a = textNotation.docFromTextNotation(`(a| '(b 1))`);
      const b = textNotation.docFromTextNotation(`(a '(|b 1))`);
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.downList();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Skips whitespace', () => {
      const a = textNotation.docFromTextNotation('(a|•  (b 1))');
      const b = textNotation.docFromTextNotation('(a•  (|b 1))');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.downList();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Does not skip metadata', () => {
      const a = textNotation.docFromTextNotation('(a| ^{:x 1} (b 1))');
      const b = textNotation.docFromTextNotation('(a ^{|:x 1} (b 1))');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.downList();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
  });

  describe('downListSkippingMeta', () => {
    it('Moves down, skipping metadata', () => {
      const a = textNotation.docFromTextNotation('(|a #b ^{:x 1} (c 1))');
      const b = textNotation.docFromTextNotation('(a #b ^{:x 1} (|c 1))');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.downListSkippingMeta();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Moves down when there is no metadata', () => {
      const a = textNotation.docFromTextNotation('(|a #b (c 1))');
      const b = textNotation.docFromTextNotation('(a #b (|c 1))');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.downListSkippingMeta();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
  });

  it('upList', () => {
    const a = textNotation.docFromTextNotation('(a(b(c•#f•(#b •[:f :b :z])•#z•1|)))');
    const b = textNotation.docFromTextNotation('(a(b(c•#f•(#b •[:f :b :z])•#z•1)|))');
    const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
    cursor.upList();
    expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
  });

  describe('forwardList', () => {
    it('Finds end of list', () => {
      const a = textNotation.docFromTextNotation('(|foo (bar baz) [])');
      const b = textNotation.docFromTextNotation('(foo (bar baz) []|)');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardList();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Finds end of list through readers and meta', () => {
      const a = textNotation.docFromTextNotation('(|#a ^{:b c} #d (bar baz) [])');
      const b = textNotation.docFromTextNotation('(#a ^{:b c} #d (bar baz) []|)');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardList();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Does not move at top level', () => {
      const a = textNotation.docFromTextNotation('|foo (bar baz)');
      const b = textNotation.docFromTextNotation('|foo (bar baz)');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardList();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Does not move at top level when unbalanced document from extra closings', () => {
      const a = textNotation.docFromTextNotation('|foo (bar baz))');
      const b = textNotation.docFromTextNotation('|foo (bar baz))');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardList();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Does not move at top level when unbalanced document from extra opens', () => {
      const a = textNotation.docFromTextNotation('|foo ((bar baz)');
      const b = textNotation.docFromTextNotation('|foo ((bar baz)');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardList();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Does not move when unbalanced from extra opens', () => {
      const a = textNotation.docFromTextNotation('(|[');
      const b = textNotation.docFromTextNotation('(|[');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardList();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Does not move when at end of list, returns true', () => {
      const a = textNotation.docFromTextNotation('(|)');
      const b = textNotation.docFromTextNotation('(|)');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.forwardList();
      expectLib.expect(result).toBe(true);
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Finds the list end when unbalanced from extra closes outside the current list', () => {
      const a = textNotation.docFromTextNotation('(|a #b []))');
      const b = textNotation.docFromTextNotation('(a #b []|))');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardList();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
  });

  describe('backwardList', () => {
    it('Finds start of list', () => {
      const a = textNotation.docFromTextNotation('(((c•(#b •[:f])•#z•|a)))');
      const b = textNotation.docFromTextNotation('(((|c•(#b •[:f])•#z•1)))');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardList();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Finds start of list through readers', () => {
      const a = textNotation.docFromTextNotation('(((c•#a• #f•(#b •[:f])•#z•|a)))');
      const b = textNotation.docFromTextNotation('(((|c•#a• #f•(#b •[:f])•#z•1)))');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardList();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Finds start of list through metadata', () => {
      const a = textNotation.docFromTextNotation('(((c•^{:a c} (#b •[:f])•#z•|a)))');
      const b = textNotation.docFromTextNotation('(((|c•^{:a c} (#b •[:f])•#z•1)))');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardList();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Does not move at top level', () => {
      const a = textNotation.docFromTextNotation('foo |(bar baz)');
      const b = textNotation.docFromTextNotation('foo |(bar baz)');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardList();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Does not move when at start of unbalanced list', () => {
      // https://github.com/BetterThanTomorrow/calva/issues/1573
      // https://github.com/BetterThanTomorrow/calva/commit/d77359fcea16bc052ab829853d5711434330a375
      const a = textNotation.docFromTextNotation('([|');
      const b = textNotation.docFromTextNotation('([|');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.backwardList();
      expectLib.expect(result).toBe(false);
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Does not move to start of an unbalanced list when outer list is also unbalanced', () => {
      // NB: This is a bit arbitrary, this test documents the current behaviour
      const a = textNotation.docFromTextNotation('(let [a| a');
      const b = textNotation.docFromTextNotation('(let [a| a');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.backwardList();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      expectLib.expect(result).toBe(false);
    });
    it('Moves to start of an unbalanced list when outer list is balanced', () => {
      // NB: This is a bit arbitrary, this test documents the current behaviour
      const a = textNotation.docFromTextNotation('(let [a| a)');
      const b = textNotation.docFromTextNotation('(let [|a a)');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.backwardList();
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      expectLib.expect(result).toBe(true);
    });
    it('Finds the list start when unbalanced from extra closes outside the current list', () => {
      const a = textNotation.docFromTextNotation('([]|))');
      const b = textNotation.docFromTextNotation('(|[]))');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.backwardList();
      expectLib.expect(result).toBe(true);
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
  });

  describe('forwardListOfType', () => {
    it('Finds end of list', () => {
      const a = textNotation.docFromTextNotation('([#{|c•(#b •[:f])•#z•1}])');
      const b = textNotation.docFromTextNotation('([#{c•(#b •[:f])•#z•1}]|)');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.forwardListOfType(')');
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      expectLib.expect(result).toBe(true);
    });
    it('Finds end of vector', () => {
      const a = textNotation.docFromTextNotation('([(c•(#b| •[:f])•#z•1)])');
      const b = textNotation.docFromTextNotation('([(c•(#b •[:f])•#z•1)|])');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.forwardListOfType(']');
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      expectLib.expect(result).toBe(true);
    });
    it('Finds end of map', () => {
      const a = textNotation.docFromTextNotation('({:a [(c•(#|b •[:f])•#z•|a)]})');
      const b = textNotation.docFromTextNotation('({:a [(c•(#b •[:f])•#z•1)]|})');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.forwardListOfType('}');
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      expectLib.expect(result).toBe(true);
    });
    it('Does not move when list is unbalanced from missing open', () => {
      const a = textNotation.docFromTextNotation('|])');
      const b = textNotation.docFromTextNotation('|])');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.forwardListOfType(')');
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      expectLib.expect(result).toBe(false);
    });
    it('Does not move when list type is not found', () => {
      const a = textNotation.docFromTextNotation('([|])');
      const b = textNotation.docFromTextNotation('([|])');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.forwardListOfType('}');
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      expectLib.expect(result).toBe(false);
    });
  });

  describe('backwardListOfType', () => {
    it('Finds start of list', () => {
      const a = textNotation.docFromTextNotation('([#{c•(#b •[:f])•#z•|a}])');
      const b = textNotation.docFromTextNotation('(|[#{c•(#b •[:f])•#z•1}])');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.backwardListOfType('(');
      expectLib.expect(result).toBe(true);
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
    });
    it('Finds start of vector', () => {
      const a = textNotation.docFromTextNotation('([(c•(#b •[:f])•#z•|a)])');
      const b = textNotation.docFromTextNotation('([|(c•(#b •[:f])•#z•1)])');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.backwardListOfType('[');
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      expectLib.expect(result).toBe(true);
    });
    it('Finds start of map', () => {
      const a = textNotation.docFromTextNotation('({:a [(c•(#b •[:f])•#z•|a)]})');
      const b = textNotation.docFromTextNotation('({|:a [(c•(#b •[:f])•#z•1)]})');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.backwardListOfType('{');
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      expectLib.expect(result).toBe(true);
    });
    it('Does not move when list type is unbalanced from missing close', () => {
      // This hung the structural editing in the real editor
      // https://github.com/BetterThanTomorrow/calva/issues/1573
      const a = textNotation.docFromTextNotation('([|');
      const b = textNotation.docFromTextNotation('([|');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.backwardListOfType('(');
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      expectLib.expect(result).toBe(false);
    });
    it('Moves backward in unbalanced list when outer list is balanced', () => {
      // https://github.com/BetterThanTomorrow/calva/issues/1585
      const a = textNotation.docFromTextNotation('(let [a|)');
      const b = textNotation.docFromTextNotation('(let [|a)');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.backwardListOfType('[');
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      expectLib.expect(result).toBe(true);
    });
    it('Moves backward in balanced list when inner list is unbalanced', () => {
      // This never completes in Calva v2.0.252
      // https://github.com/BetterThanTomorrow/calva/issues/1585
      const a = textNotation.docFromTextNotation('(let [a|)');
      const b = textNotation.docFromTextNotation('(|let [a)');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.backwardListOfType('(');
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      expectLib.expect(result).toBe(true);
    });
    it('Does not move when list type is not found', () => {
      const a = textNotation.docFromTextNotation('([|])');
      const b = textNotation.docFromTextNotation('([|])');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      const result = cursor.backwardListOfType('{');
      expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      expectLib.expect(result).toBe(false);
    });
  });

  it('backwardUpList', () => {
    const a = textNotation.docFromTextNotation('(a(b(c•#f•(#b •|[:f :b :z])•#z•1)))');
    const b = textNotation.docFromTextNotation('(a(b(c•#f•|(#b •[:f :b :z])•#z•1)))');
    const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
    cursor.backwardUpList();
    expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
  });

  describe('Navigation in and around strings', () => {
    it('backwardList moves to start of string', () => {
      const a = textNotation.docFromTextNotation(
        '(str [] "", "foo" "f |  b  b"   "   f b b   " "\\"" \\")'
      );
      const b = textNotation.docFromTextNotation(
        '(str [] "", "foo" "|f   b  b"   "   f b b   " "\\"" \\")'
      );
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardList();
      expectLib.expect(cursor.offsetStart).toEqual(b.selections[0].anchor);
    });
    it('forwardList moves to end of string', () => {
      const a = textNotation.docFromTextNotation(
        '(str [] "", "foo" "f |  b  b"   "   f b b   " "\\"" \\")'
      );
      const b = textNotation.docFromTextNotation(
        '(str [] "", "foo" "f   b  b|"   "   f b b   " "\\"" \\")'
      );
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.forwardList();
      expectLib.expect(cursor.offsetStart).toEqual(b.selections[0].anchor);
    });
    it('backwardSexpr inside string moves past quoted characters', () => {
      const a = textNotation.docFromTextNotation('(str [] "foo \\"| bar")');
      const b = textNotation.docFromTextNotation('(str [] "foo |\\" bar")');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp();
      expectLib.expect(cursor.offsetStart).toEqual(b.selections[0].anchor);
    });
  });

  describe('The REPL prompt', () => {
    it('Backward sexp bypasses prompt', () => {
      const a = textNotation.docFromTextNotation('foo•clj꞉foo꞉> |');
      const b = textNotation.docFromTextNotation('|foo•clj꞉foo꞉> ');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp();
      expectLib.expect(cursor.offsetStart).toEqual(b.selections[0].active);
    });
    it('Backward sexp not skipping comments bypasses prompt finding its start', () => {
      const a = textNotation.docFromTextNotation('foo•clj꞉foo꞉> |');
      const b = textNotation.docFromTextNotation('foo•|clj꞉foo꞉> ');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      cursor.backwardSexp(false);
      expectLib.expect(cursor.offsetStart).toEqual(b.selections[0].active);
    });
  });

  describe('Current Form', () => {
    it('0: selects from within non-list form', () => {
      const a = textNotation.docFromTextNotation('(a|aa (bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x');
      const b = textNotation.docFromTextNotation('(|aaa| (bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib
        .expect(cursor.rangeForCurrentForm(a.selections[0].anchor))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('0: selects from within non-list form including reader tag', () => {
      const a = textNotation.docFromTextNotation('(#a a|aa (foo bar)))');
      const b = textNotation.docFromTextNotation('(|#a aaa| (foo bar)))');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib
        .expect(cursor.rangeForCurrentForm(a.selections[0].anchor))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('0: selects from within non-list form including multiple reader tags', () => {
      const a = textNotation.docFromTextNotation('(#aa #a #b a|aa (foo bar)))');
      const b = textNotation.docFromTextNotation('(|#aa #a #b aaa| (foo bar)))');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib
        .expect(cursor.rangeForCurrentForm(a.selections[0].anchor))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('0: selects from within non-list form including metadata', () => {
      const a = textNotation.docFromTextNotation('(^aa #a a|aa (foo bar)))');
      const b = textNotation.docFromTextNotation('(|^aa #a aaa| (foo bar)))');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib
        .expect(cursor.rangeForCurrentForm(a.selections[0].anchor))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('0: selects from within non-list form including readers and metadata', () => {
      const a = textNotation.docFromTextNotation('(^aa #a a|aa (foo bar))');
      const b = textNotation.docFromTextNotation('(|^aa #a aaa| (foo bar))');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib
        .expect(cursor.rangeForCurrentForm(a.selections[0].anchor))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('0: selects from within non-list form including metadata and readers', () => {
      const a = textNotation.docFromTextNotation('(#a ^aa a|aa (foo bar))');
      const b = textNotation.docFromTextNotation('(|#a ^aa aaa| (foo bar))');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib
        .expect(cursor.rangeForCurrentForm(a.selections[0].anchor))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('1: selects from adjacent when after form', () => {
      const a = textNotation.docFromTextNotation('(aaa •x•#(a b c)|)•#baz•yyy•)');
      const b = textNotation.docFromTextNotation('(aaa •x•|#(a b c)|)•#baz•yyy•)');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib
        .expect(cursor.rangeForCurrentForm(a.selections[0].anchor))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('1: selects from adjacent when after form, including reader tags', () => {
      const a = textNotation.docFromTextNotation('(x• #a #b •#(a b c)|)•#baz•yyy•)');
      const b = textNotation.docFromTextNotation('(x• |#a #b •#(a b c)|)•#baz•yyy•)');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib
        .expect(cursor.rangeForCurrentForm(a.selections[0].anchor))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('1: selects from adjacent when after form, including readers and meta data', () => {
      const a = textNotation.docFromTextNotation('(x• ^a #b •#(a b c)|)•#baz•yyy•)');
      const b = textNotation.docFromTextNotation('(x• |^a #b •#(a b c)|)•#baz•yyy•)');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib
        .expect(cursor.rangeForCurrentForm(a.selections[0].anchor))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('1: selects from adjacent when after form, including meta data and readers', () => {
      const a = textNotation.docFromTextNotation('(x• #a ^b •#(a b c)|)•#baz•yyy•)');
      const b = textNotation.docFromTextNotation('(x• |#a ^b •#(a b c)|)•#baz•yyy•)');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib
        .expect(cursor.rangeForCurrentForm(a.selections[0].anchor))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('2: selects from adjacent before form', () => {
      const a = textNotation.docFromTextNotation('#bar •#baz•[:a :b :c]•x•|#(a b c)');
      const b = textNotation.docFromTextNotation('#bar •#baz•[:a :b :c]•x•|#(a b c)|');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib
        .expect(cursor.rangeForCurrentForm(a.selections[0].anchor))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('2: selects from adjacent before form, including reader tags', () => {
      const a = textNotation.docFromTextNotation('|#bar •#baz•[:a :b :c]•x');
      const b = textNotation.docFromTextNotation('|#bar •#baz•[:a :b :c]|•x');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib
        .expect(cursor.rangeForCurrentForm(a.selections[0].anchor))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('2: selects from adjacent before form, including meta data', () => {
      const a = textNotation.docFromTextNotation('|^bar •[:a :b :c]•x');
      const b = textNotation.docFromTextNotation('|^bar •[:a :b :c]|•x');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib
        .expect(cursor.rangeForCurrentForm(a.selections[0].anchor))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('2: selects from adjacent before form, including meta data and reader', () => {
      const a = textNotation.docFromTextNotation('|^bar •#baz•[:a :b :c]•x');
      const b = textNotation.docFromTextNotation('|^bar •#baz•[:a :b :c]|•x');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib
        .expect(cursor.rangeForCurrentForm(a.selections[0].anchor))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('2: selects from adjacent before form, including preceding reader and meta data', () => {
      const a = textNotation.docFromTextNotation('^bar •#baz•|[:a :b :c]•x');
      const b = textNotation.docFromTextNotation('|^bar •#baz•[:a :b :c]|•x');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib
        .expect(cursor.rangeForCurrentForm(a.selections[0].anchor))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('2: selects from adjacent before form, including preceding meta data and reader', () => {
      const a = textNotation.docFromTextNotation('#bar •^baz•|[:a :b :c]•x');
      const b = textNotation.docFromTextNotation('|#bar •^baz•[:a :b :c]|•x');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib
        .expect(cursor.rangeForCurrentForm(a.selections[0].anchor))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('2: selects from adjacent before form, or in readers', () => {
      const a = textNotation.docFromTextNotation(
        'ccc •#foo•|•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy'
      );
      const b = textNotation.docFromTextNotation(
        'ccc •|#foo••(#bar •#baz•[:a :b :c]•x•#(a b c))|•#baz•yyy'
      );
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib
        .expect(cursor.rangeForCurrentForm(a.selections[0].anchor))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('2: selects from adjacent before a form with reader tags', () => {
      const a = textNotation.docFromTextNotation('#bar |•#baz•[:a :b :c]•x');
      const b = textNotation.docFromTextNotation('|#bar •#baz•[:a :b :c]|•x');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib
        .expect(cursor.rangeForCurrentForm(a.selections[0].anchor))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('3: selects previous form, if on the same line', () => {
      const a = textNotation.docFromTextNotation('z z  | •foo•   •   bar');
      const b = textNotation.docFromTextNotation('z |z|   •foo•   •   bar');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib
        .expect(cursor.rangeForCurrentForm(a.selections[0].anchor))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('4: selects next form, if on the same line', () => {
      const a = textNotation.docFromTextNotation('yyy•|   z z z   •foo•   •   bar');
      const b = textNotation.docFromTextNotation('yyy•   |z| z z   •foo•   •   bar');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib
        .expect(cursor.rangeForCurrentForm(a.selections[0].anchor))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('5: selects previous form, if any', () => {
      const a = textNotation.docFromTextNotation('yyy•   z z z   •foo•   |•   bar');
      const b = textNotation.docFromTextNotation('yyy•   z z z   •|foo|•   •   bar');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib
        .expect(cursor.rangeForCurrentForm(a.selections[0].anchor))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('5: selects previous form, if any, when next form has metadata', () => {
      const a = textNotation.docFromTextNotation('z•foo•|•^{:a b}•bar');
      const b = textNotation.docFromTextNotation('z•|foo|••^{:a b}•bar');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib
        .expect(cursor.rangeForCurrentForm(a.selections[0].anchor))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('6: selects next form, if any', () => {
      const a = textNotation.docFromTextNotation(' | •  (foo {:a b})•(c)');
      const b = textNotation.docFromTextNotation('  •  |(foo {:a b})|•(c)');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib
        .expect(cursor.rangeForCurrentForm(a.selections[0].anchor))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('7: selects enclosing form, if any', () => {
      const a = textNotation.docFromTextNotation('(|)  •  (foo {:a b})•(c)');
      const b = textNotation.docFromTextNotation('|()|  •  (foo {:a b})•(c)');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib
        .expect(cursor.rangeForCurrentForm(a.selections[0].anchor))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('2: selects anonymous function when cursor is before #', () => {
      const a = textNotation.docFromTextNotation('(map |#(println %) [1 2])');
      const b = textNotation.docFromTextNotation('(map |#(println %)| [1 2])');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib
        .expect(cursor.rangeForCurrentForm(a.selections[0].anchor))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('2: selects anonymous function when cursor is after # and before (', () => {
      const a = textNotation.docFromTextNotation('(map #|(println %) [1 2])');
      const b = textNotation.docFromTextNotation('(map |#(println %)| [1 2])');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib
        .expect(cursor.rangeForCurrentForm(a.selections[0].anchor))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('8: does not croak on unbalance', () => {
      // This hangs the structural editing in the real editor
      // https://github.com/BetterThanTomorrow/calva/issues/1573
      const a = textNotation.docFromTextNotation('([|');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib.expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toBeUndefined();
    });
    it('2: selects ignore form including #_ when cursor is before the marker', () => {
      const a = textNotation.docFromTextNotation(':bar |#_"foo"');
      const b = textNotation.docFromTextNotation(':bar |#_"foo"|');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib
        .expect(cursor.rangeForCurrentForm(a.selections[0].anchor))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('2: selects ignore form including #_ when cursor is before marker at start of file', () => {
      const a = textNotation.docFromTextNotation('|#_(foo bar)');
      const b = textNotation.docFromTextNotation('|#_(foo bar)|');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib
        .expect(cursor.rangeForCurrentForm(a.selections[0].anchor))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('selects ignore form including #_ for all cursor positions within #_:a', () => {
      const b = textNotation.docFromTextNotation('|#_:a|');
      const expected = textNotation.textAndSelection(b)[1];
      for (const notation of ['|#_:a', '#|_:a', '#_|:a', '#_:|a', '#_:a|']) {
        const a = textNotation.docFromTextNotation(notation);
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
        expectLib.expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toEqual(expected);
      }
    });
    it('selects ignore form including #_ for cursor before, within, and adjacent to #_(foo bar)', () => {
      const b = textNotation.docFromTextNotation('|#_(foo bar)|');
      const expected = textNotation.textAndSelection(b)[1];
      for (const notation of ['|#_(foo bar)', '#|_(foo bar)', '#_|(foo bar)']) {
        const a = textNotation.docFromTextNotation(notation);
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
        expectLib.expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toEqual(expected);
      }
    });
    it('selects ignore form including #_ when cursor after #_:a in #_:a :b', () => {
      const a = textNotation.docFromTextNotation('#_:a| :b');
      const b = textNotation.docFromTextNotation('|#_:a| :b');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib
        .expect(cursor.rangeForCurrentForm(a.selections[0].anchor))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('selects ignore form including #_ when cursor is at end of #_     :a (spaces between)', () => {
      const a = textNotation.docFromTextNotation('#_     :a|');
      const b = textNotation.docFromTextNotation('|#_     :a|');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib
        .expect(cursor.rangeForCurrentForm(a.selections[0].anchor))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('Selects atomic form to the right, when squeezed by an ignore marker', () => {
      const a = docFromTextNotation('#_|a');
      const b = docFromTextNotation('#_|a|');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toEqual(textAndSelection(b)[1]);
    });
    it('Selects list form to the right, when squeezed by an ignore marker', () => {
      const a = docFromTextNotation('#_|(a)');
      const b = docFromTextNotation('#_|(a)|');
      const cursor: LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
      expect(cursor.rangeForCurrentForm(a.selections[0].anchor)).toEqual(textAndSelection(b)[1]);
    });
  });

  describe('Top Level Form', () => {
    it('Finds range when nested down some forms', () => {
      const a = textNotation.docFromTextNotation(
        'aaa (bbb (ccc •#foo•(#bar •#baz•[:a :b| :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)) (ddd eee)'
      );
      const b = textNotation.docFromTextNotation(
        'aaa |(bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar))| (ddd eee)'
      );
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
      expectLib
        .expect(cursor.rangeForDefun(a.selections[0].active))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('Finds range when in current form is top level', () => {
      const a = textNotation.docFromTextNotation(
        'aaa (bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)) |(ddd eee)'
      );
      const b = textNotation.docFromTextNotation(
        'aaa (bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)) |(ddd eee)|'
      );
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
      expectLib
        .expect(cursor.rangeForDefun(a.selections[0].active))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('Finds range when in ”solid” top level form', () => {
      const a = textNotation.docFromTextNotation(
        'a|aa (bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)) (ddd eee)'
      );
      const b = textNotation.docFromTextNotation(
        '|aaa| (bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)) (ddd eee)'
      );
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
      expectLib
        .expect(cursor.rangeForDefun(a.selections[0].active))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    it('Finds something when there is unbalance', () => {
      const a = textNotation.docFromTextNotation(
        '(ns xxx)•(def xxx|•{()"#"\\$" #"(?!\\w)"))))))))))))))))))))))))))))))))))))))))'
      );
      const b = textNotation.docFromTextNotation(
        '(ns xxx)•(def xxx•|{()"#"\\$" #"(?!\\w)"))))))))))))))))))))))))))))))))))))))))|'
      );
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
      expectLib
        .expect(cursor.rangeForDefun(a.selections[0].active))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    // https://github.com/BetterThanTomorrow/calva/issues/2655
    it('Does not include ignore marker', () => {
      const a = textNotation.docFromTextNotation('a #_ [b (c|)] [d]');
      const b = textNotation.docFromTextNotation('a #_ |[b (c)]| [d]');
      const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
      expectLib
        .expect(cursor.rangeForDefun(a.selections[0].active))
        .toEqual(textNotation.textAndSelection(b)[1]);
    });
    describe('Rich Comment Form top level context', () => {
      it('Finds range for a top level form inside a comment', () => {
        const a = textNotation.docFromTextNotation('aaa (comment [bbb cc|c]  ddd)');
        const b = textNotation.docFromTextNotation('aaa (comment |[bbb ccc]|  ddd)');
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expectLib
          .expect(cursor.rangeForDefun(a.selections[0].active))
          .toEqual(textNotation.textAndSelection(b)[1]);
      });
      it('Finds range for a top level map inside a comment', () => {
        const a = textNotation.docFromTextNotation('aaa (comment {bbb cc|c}  ddd)');
        const b = textNotation.docFromTextNotation('aaa (comment |{bbb ccc}|  ddd)');
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expectLib
          .expect(cursor.rangeForDefun(a.selections[0].active))
          .toEqual(textNotation.textAndSelection(b)[1]);
      });
      // https://github.com/BetterThanTomorrow/calva/issues/2290
      describe('Rich Comment Form top level context from inside form', () => {
        it('Finds range for a top level function call inside a comment from inside a string', () => {
          const a = textNotation.docFromTextNotation('aaa (comment (bbb "cc|c")  ddd)');
          const b = textNotation.docFromTextNotation('aaa (comment |(bbb "ccc")|  ddd)');
          const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
          expectLib
            .expect(cursor.rangeForDefun(a.selections[0].active))
            .toEqual(textNotation.textAndSelection(b)[1]);
        });
        it('Finds range for a top level shortcut lambda function inside a comment from inside a string', () => {
          const a = textNotation.docFromTextNotation('aaa (comment #(bbb "cc|c")  ddd)');
          const b = textNotation.docFromTextNotation('aaa (comment |#(bbb "ccc")|  ddd)');
          const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
          expectLib
            .expect(cursor.rangeForDefun(a.selections[0].active))
            .toEqual(textNotation.textAndSelection(b)[1]);
        });
        it('Finds range for a top level quoted list inside a comment from inside a string', () => {
          const a = textNotation.docFromTextNotation(`aaa (comment '(bbb "cc|c")  ddd)`);
          const b = textNotation.docFromTextNotation(`aaa (comment |'(bbb "ccc")|  ddd)`);
          const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
          expectLib
            .expect(cursor.rangeForDefun(a.selections[0].active))
            .toEqual(textNotation.textAndSelection(b)[1]);
        });
        it('Finds range for a top level map inside a comment from inside a string', () => {
          const a = textNotation.docFromTextNotation('aaa (comment {bbb "cc|c"}  ddd)');
          const b = textNotation.docFromTextNotation('aaa (comment |{bbb "ccc"}|  ddd)');
          const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
          expectLib
            .expect(cursor.rangeForDefun(a.selections[0].active))
            .toEqual(textNotation.textAndSelection(b)[1]);
        });
        it('Finds range for a top level map inside a comment from inside a form', () => {
          const a = textNotation.docFromTextNotation('aaa (comment {bbb [cc|c]}  ddd)');
          const b = textNotation.docFromTextNotation('aaa (comment |{bbb [ccc]}|  ddd)');
          const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
          expectLib
            .expect(cursor.rangeForDefun(a.selections[0].active))
            .toEqual(textNotation.textAndSelection(b)[1]);
        });
        it('Finds range for a top level set inside a comment from inside a string', () => {
          const a = textNotation.docFromTextNotation('aaa (comment #{bbb "cc|c"}  ddd)');
          const b = textNotation.docFromTextNotation('aaa (comment |#{bbb "ccc"}|  ddd)');
          const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
          expectLib
            .expect(cursor.rangeForDefun(a.selections[0].active))
            .toEqual(textNotation.textAndSelection(b)[1]);
        });
        it('Finds range for a top level vector inside a comment from inside a string', () => {
          const a = textNotation.docFromTextNotation('aaa (comment [bbb "cc|c"]  ddd)');
          const b = textNotation.docFromTextNotation('aaa (comment |[bbb "ccc"]|  ddd)');
          const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
          expectLib
            .expect(cursor.rangeForDefun(a.selections[0].active))
            .toEqual(textNotation.textAndSelection(b)[1]);
        });
      });
      it('Finds range for a top level form inside a comment inside a form', () => {
        const a = textNotation.docFromTextNotation('a (b (comment [c |d] e))');
        const b = textNotation.docFromTextNotation('a (b (comment |[c d]| e))');
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expectLib
          .expect(cursor.rangeForDefun(a.selections[0].active))
          .toEqual(textNotation.textAndSelection(b)[1]);
      });
      it('Finds top level comment range if comment special treatment is disabled', () => {
        const a = textNotation.docFromTextNotation(
          'aaa (comment (ccc •#foo•(#bar •#baz•[:a :b| :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)) (ddd eee)'
        );
        const b = textNotation.docFromTextNotation(
          'aaa |(comment (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar))| (ddd eee)'
        );
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expectLib
          .expect(cursor.rangeForDefun(a.selections[0].active, false))
          .toEqual(textNotation.textAndSelection(b)[1]);
      });
      it('Finds comment range for empty comment form', () => {
        // Unimportant use case, just documenting how it behaves
        const a = textNotation.docFromTextNotation('aaa (comment |  ) bbb');
        const b = textNotation.docFromTextNotation('aaa (|comment|   ) bbb');
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expectLib
          .expect(cursor.rangeForDefun(a.selections[0].active))
          .toEqual(textNotation.textAndSelection(b)[1]);
      });
      it('Does not find comment range when comments are nested', () => {
        const a = textNotation.docFromTextNotation('aaa (comment (comment [bbb ccc] | ddd))');
        const b = textNotation.docFromTextNotation('aaa (comment (comment |[bbb ccc]|  ddd))');
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expectLib
          .expect(cursor.rangeForDefun(a.selections[0].active))
          .toEqual(textNotation.textAndSelection(b)[1]);
      });
      it('Finds comment range when current form is top level comment form', () => {
        const a = textNotation.docFromTextNotation(
          'aaa (bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)) |(comment eee)'
        );
        const b = textNotation.docFromTextNotation(
          'aaa (bbb (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)) |(comment eee)|'
        );
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expectLib
          .expect(cursor.rangeForDefun(a.selections[0].active))
          .toEqual(textNotation.textAndSelection(b)[1]);
      });
      it('Includes reader tag', () => {
        const a = textNotation.docFromTextNotation('aaa (comment #r [bbb ccc|]  ddd)');
        const b = textNotation.docFromTextNotation('aaa (comment |#r [bbb ccc]|  ddd)');
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expectLib
          .expect(cursor.rangeForDefun(a.selections[0].active))
          .toEqual(textNotation.textAndSelection(b)[1]);
      });
      it('Finds the preceding range when cursor is between to forms on the same line', () => {
        const a = textNotation.docFromTextNotation('aaa (comment [bbb ccc] | ddd)');
        const b = textNotation.docFromTextNotation('aaa (comment |[bbb ccc]|  ddd)');
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expectLib
          .expect(cursor.rangeForDefun(a.selections[0].active))
          .toEqual(textNotation.textAndSelection(b)[1]);
      });
      it('Finds the succeeding range when cursor is at the start of the line', () => {
        const a = textNotation.docFromTextNotation('aaa (comment [bbb ccc]• | ddd)');
        const b = textNotation.docFromTextNotation('aaa (comment [bbb ccc]•  |ddd|)');
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expectLib
          .expect(cursor.rangeForDefun(a.selections[0].active))
          .toEqual(textNotation.textAndSelection(b)[1]);
      });
      it('Finds the preceding comment symbol range when cursor is between that and something else on the same line', () => {
        // This is a bit funny, but is not an important use case
        const a = textNotation.docFromTextNotation('aaa (comment  | [bbb ccc]  ddd)');
        const b = textNotation.docFromTextNotation('aaa (|comment|   [bbb ccc]  ddd)');
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expectLib
          .expect(cursor.rangeForDefun(a.selections[0].active))
          .toEqual(textNotation.textAndSelection(b)[1]);
      });
      it('Can find the comment range for a top level form inside a comment', () => {
        const a = textNotation.docFromTextNotation(
          'aaa (comment (ccc •#foo•(#bar •#baz•[:a :b| :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar)) (ddd eee)'
        );
        const b = textNotation.docFromTextNotation(
          'aaa |(comment (ccc •#foo•(#bar •#baz•[:a :b :c]•x•#(a b c))•#baz•yyy•   z z z   •foo•   •   bar))| (ddd eee)'
        );
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(0);
        expectLib
          .expect(cursor.rangeForDefun(a.selections[0].anchor, false))
          .toEqual(textNotation.textAndSelection(b)[1]);
      });
      it('Finds closest form inside multiple nested comments', () => {
        const a = textNotation.docFromTextNotation('aaa (comment (comment [bbb ccc] | ddd))');
        const b = textNotation.docFromTextNotation('aaa (comment (comment |[bbb ccc]|  ddd))');
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(0);
        expectLib
          .expect(cursor.rangeForDefun(a.selections[0].anchor))
          .toEqual(textNotation.textAndSelection(b)[1]);
      });
      it('Finds the preceding range when cursor is between two forms on the same line', () => {
        const a = textNotation.docFromTextNotation('aaa (comment [bbb ccc] | ddd)');
        const b = textNotation.docFromTextNotation('aaa (comment |[bbb ccc]|  ddd)');
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(0);
        expectLib
          .expect(cursor.rangeForDefun(a.selections[0].anchor))
          .toEqual(textNotation.textAndSelection(b)[1]);
      });
      it('Finds top level form when deref in comment', () => {
        const a = textNotation.docFromTextNotation('(comment @(foo [bar|]))');
        const b = textNotation.docFromTextNotation('(comment |@(foo [bar])|)');
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(0);
        expectLib
          .expect(cursor.rangeForDefun(a.selections[0].anchor))
          .toEqual(textNotation.textAndSelection(b)[1]);
      });
      // https://github.com/BetterThanTomorrow/calva/issues/2655
      it('Does not include ignore marker', () => {
        const a = textNotation.docFromTextNotation('aaa (comment #_ [bbb ccc|]  ddd)');
        const b = textNotation.docFromTextNotation('aaa (comment #_ |[bbb ccc]|  ddd)');
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expectLib
          .expect(cursor.rangeForDefun(a.selections[0].active))
          .toEqual(textNotation.textAndSelection(b)[1]);
      });
      it('Does not include ignore marker with no whitespaces', () => {
        const a = textNotation.docFromTextNotation('aaa (comment #_[bbb ccc|]  ddd)');
        const b = textNotation.docFromTextNotation('aaa (comment #_|[bbb ccc]|  ddd)');
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expectLib
          .expect(cursor.rangeForDefun(a.selections[0].active))
          .toEqual(textNotation.textAndSelection(b)[1]);
      });
    });
  });

  describe('Utilities', () => {
    describe('getFunctionName', () => {
      it('Finds function name in the current list', () => {
        const a = textNotation.docFromTextNotation('(foo [|])');
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
        expectLib.expect(cursor.getFunctionName()).toEqual('foo');
      });
      it('Does not croak finding function name in unbalance', () => {
        // This hung the structural editing in the real editor
        // https://github.com/BetterThanTomorrow/calva/issues/1573
        const a = textNotation.docFromTextNotation('([|');
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
        expectLib.expect(cursor.getFunctionName()).toBeUndefined();
      });
    });
    describe('createStringCursor', () => {
      it('Ranges account for newline', () => {
        const cursor = tokenCursor.createStringCursor('(a\n(b))');
        const topLevelRanges = cursor.rangesForTopLevelForms().flat();
        expectLib.expect(topLevelRanges).toEqual([0, 7]);
      });
      it('Ranges account for newline (MS-Windows)', () => {
        const cursor = tokenCursor.createStringCursor('(a\r\n(b))');
        const topLevelRanges = cursor.rangesForTopLevelForms().flat();
        expectLib.expect(topLevelRanges).toEqual([0, 8]);
      });
    });
    describe('atTopLevel', () => {
      it('Returns true when at top level', () => {
        const a = textNotation.docFromTextNotation('(foo []) |(bar :baz)');
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expectLib.expect(cursor.atTopLevel()).toEqual(true);
      });
      it('Returns true when at top level in rich comment if instructed so', () => {
        const a = textNotation.docFromTextNotation('( comment (foo []) |(bar :baz))');
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expectLib.expect(cursor.atTopLevel(true)).toEqual(true);
      });
      it('Returns true when at a top level map in rich comment if instructed so', () => {
        const a = textNotation.docFromTextNotation('( comment (foo []) |{bar :baz})');
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expectLib.expect(cursor.atTopLevel(true)).toEqual(true);
      });
      // TODO: Figure out if this should be how it works
      // Related to: https://github.com/BetterThanTomorrow/calva/issues/2109
      it('Returns true when at top level in rich comment if instructed so, even if comment is not at top level', () => {
        const a = textNotation.docFromTextNotation('(a ( comment (foo []) |(bar :baz)))');
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expectLib.expect(cursor.atTopLevel(true)).toEqual(true);
      });
      it('Returns true when at a top level map in rich comment if instructed so, even if comment is not at top level', () => {
        const a = textNotation.docFromTextNotation('(a ( comment (foo []) |{bar :baz}))');
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expectLib.expect(cursor.atTopLevel(true)).toEqual(true);
      });
      it('Returns false when at top level in rich comment if not instructed to treat it so', () => {
        const a = textNotation.docFromTextNotation('( comment (foo []) |(bar :baz))');
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expectLib.expect(cursor.atTopLevel()).toEqual(false);
      });
      it('Returns false when not at top level', () => {
        const a = textNotation.docFromTextNotation('(foo |[])');
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].active);
        expectLib.expect(cursor.atTopLevel()).toEqual(false);
      });
    });

    describe('docIsBalanced', () => {
      it('Reports balance for balanced structure', () => {
        const doc = textNotation.docFromTextNotation('(a)•|(b)');
        const cursor: tokenCursor.LispTokenCursor = doc.getTokenCursor(doc.selections[0].active);
        expectLib.expect(cursor.docIsBalanced()).toBe(true);
      });
      it('Detects unbalance when lacking opening brackets', () => {
        const doc = textNotation.docFromTextNotation('(a)•|(b))');
        const cursor: tokenCursor.LispTokenCursor = doc.getTokenCursor(doc.selections[0].active);
        expectLib.expect(cursor.docIsBalanced()).toBe(false);
      });
      // TODO: Fix this
      xit('Detects unbalance when lacking closing brackets', () => {
        const doc = textNotation.docFromTextNotation('(a)•|(b');
        const cursor: tokenCursor.LispTokenCursor = doc.getTokenCursor(doc.selections[0].active);
        expectLib.expect(cursor.docIsBalanced()).toBe(false);
      });
      // TODO: Fix this too
      xit('Detects unbalance when lacking man closing brackets', () => {
        const doc = textNotation.docFromTextNotation('(a)•|([{((((b)');
        const cursor: tokenCursor.LispTokenCursor = doc.getTokenCursor(doc.selections[0].active);
        expectLib.expect(cursor.docIsBalanced()).toBe(false);
      });
    });

    describe('backwardFunction', () => {
      it('Finds current function start', () => {
        const a = textNotation.docFromTextNotation('(a b |c)');
        const b = textNotation.docFromTextNotation('(|a b c)');
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
        expectLib.expect(cursor.backwardFunction()).toBe(true);
        expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      });
      it('Finds current function start when nested', () => {
        const a = textNotation.docFromTextNotation('(a b (c d|))');
        const b = textNotation.docFromTextNotation('(a b (|c d))');
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
        expectLib.expect(cursor.backwardFunction()).toBe(true);
        expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      });
      it('Finds current function start when nested and inside non-function', () => {
        const a = textNotation.docFromTextNotation('(a b (c d [e f|]))');
        const b = textNotation.docFromTextNotation('(a b (|c d [e f]))');
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
        expectLib.expect(cursor.backwardFunction()).toBe(true);
        expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      });
      it('Finds current function start when nested in rich comment', () => {
        const a = textNotation.docFromTextNotation('(comment a b (c d|))');
        const b = textNotation.docFromTextNotation('(comment a b (|c d))');
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
        expectLib.expect(cursor.backwardFunction()).toBe(true);
        expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      });
      it('Finds parent function start', () => {
        const a = textNotation.docFromTextNotation('(a b (c d|))');
        const b = textNotation.docFromTextNotation('(|a b (c d))');
        const cursor: tokenCursor.LispTokenCursor = a.getTokenCursor(a.selections[0].anchor);
        expectLib.expect(cursor.backwardFunction(1)).toBe(true);
        expectLib.expect(cursor.offsetStart).toBe(b.selections[0].anchor);
      });
    });
  });

  describe('Location State', () => {
    it('Knows when inside string', () => {
      const doc = textNotation.docFromTextNotation(
        '(str [] "", "foo" "f   b  b"   "   f b b   " "\\"" \\")'
      );
      const withinEmpty = doc.getTokenCursor(9);
      expectLib.expect(withinEmpty.withinString()).toBe(true);
      const adjacentOutsideLeft = doc.getTokenCursor(8);
      expectLib.expect(adjacentOutsideLeft.withinString()).toBe(false);
      const adjacentOutsideRight = doc.getTokenCursor(10);
      expectLib.expect(adjacentOutsideRight.withinString()).toBe(false);
      const noStringWS = doc.getTokenCursor(11);
      expectLib.expect(noStringWS.withinString()).toBe(false);
      const leftOfFirstWord = doc.getTokenCursor(13);
      expectLib.expect(leftOfFirstWord.withinString()).toBe(true);
      const rightOfLastWord = doc.getTokenCursor(16);
      expectLib.expect(rightOfLastWord.withinString()).toBe(true);
      const inWord = doc.getTokenCursor(14);
      expectLib.expect(inWord.withinString()).toBe(true);
      const spaceBetweenWords = doc.getTokenCursor(21);
      expectLib.expect(spaceBetweenWords.withinString()).toBe(true);
      const spaceBeforeFirstWord = doc.getTokenCursor(33);
      expectLib.expect(spaceBeforeFirstWord.withinString()).toBe(true);
      const spaceAfterLastWord = doc.getTokenCursor(41);
      expectLib.expect(spaceAfterLastWord.withinString()).toBe(true);
      const beforeQuotedStringQuote = doc.getTokenCursor(46);
      expectLib.expect(beforeQuotedStringQuote.withinString()).toBe(true);
      const inQuotedStringQuote = doc.getTokenCursor(47);
      expectLib.expect(inQuotedStringQuote.withinString()).toBe(true);
      const afterQuotedStringQuote = doc.getTokenCursor(48);
      expectLib.expect(afterQuotedStringQuote.withinString()).toBe(true);
      const beforeLiteralQuote = doc.getTokenCursor(50);
      expectLib.expect(beforeLiteralQuote.withinString()).toBe(false);
      const inLiteralQuote = doc.getTokenCursor(51);
      expectLib.expect(inLiteralQuote.withinString()).toBe(false);
      const afterLiteralQuote = doc.getTokenCursor(52);
      expectLib.expect(afterLiteralQuote.withinString()).toBe(false);
    });
  });
});
