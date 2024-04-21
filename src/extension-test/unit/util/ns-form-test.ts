import * as expect from 'expect';
import { docFromTextNotation } from '../common/text-notation';
import * as nsFormUtil from '../../../util/ns-form';
import { resolveNsName, pathToNs, isPrefix } from '../../../util/ns-form';
import { fail } from 'assert';

describe('ns-form util', () => {
  describe('isPrefix', function () {
    it('/app/src is prefix', function () {
      expect(true).toBe(isPrefix('/app/src', '/app/src/app/file.clj'));
    });
    it('/app/resource is not prefix', function () {
      expect(false).toBe(isPrefix('/app/resource', '/app/src/app/file.clj'));
    });
  });

  describe('pathToNs', function () {
    it('test_file.clj', function () {
      expect('test-file').toBe(pathToNs('test_file.clj'));
    });
    it('foo/bar/baz/test_file.clj', function () {
      expect('foo.bar.baz.test-file').toBe(pathToNs('foo/bar/baz/test_file.clj'));
    });
    it('foo_bar_baz/test_file.clj', function () {
      expect('foo-bar-baz.test-file').toBe(pathToNs('foo_bar_baz/test_file.clj'));
    });
  });

  describe('resolveNsName', function () {
    it('with source paths', function () {
      expect('app.file').toBe(resolveNsName(['/app/src'], '/app/src/app/file.clj'));
    });
    it('with empty source paths', function () {
      expect('empty-src').toBe(resolveNsName([], '/app/src/app/empty_src.clj'));
    });
    it('with source paths (not found)', function () {
      expect('file-test').toBe(resolveNsName(['/app/src'], '/app/test/app/file_test.clj'));
    });
  });

  describe('nsFromCursorDoc', function () {
    it('defaults to `null`', function () {
      expect(nsFormUtil.nsFromCursorDoc(docFromTextNotation('(no-ns a-b.c-d)\nfoo|'))).toBe(null);
    });
    it('finds ns', function () {
      expect(
        nsFormUtil.nsFromCursorDoc(docFromTextNotation('(ns a-b.c-d) (a b c)|'))
      ).toStrictEqual(['a-b.c-d', '(ns a-b.c-d)']);
    });
    it('finds in-ns', function () {
      expect(
        nsFormUtil.nsFromCursorDoc(docFromTextNotation("(in-ns 'a-b.c-d) (a b c)|"))
      ).toStrictEqual(['a-b.c-d', "(in-ns 'a-b.c-d)"]);
    });
    it('returns `null` if ns form does not contain a namespace symbol', function () {
      expect(nsFormUtil.nsFromCursorDoc(docFromTextNotation('(ns) (a b c)|'))).toBe(null);
    });
    it('returns `null` if ns form does contains non-symbol', function () {
      expect(nsFormUtil.nsFromCursorDoc(docFromTextNotation('(ns [a]) (a b c)|'))).toBe(null);
    });
    it('finds ns in form with line comment', function () {
      expect(
        nsFormUtil.nsFromCursorDoc(docFromTextNotation('(ns a-b.c-d ; comment\n)|'))
      ).toStrictEqual(['a-b.c-d', '(ns a-b.c-d ; comment\n)']);
    });
    it('finds ns in form after line comments', function () {
      expect(
        nsFormUtil.nsFromCursorDoc(docFromTextNotation('; comment\n(ns a-b.c-d)|'))
      ).toStrictEqual(['a-b.c-d', '(ns a-b.c-d)']);
    });

    it('Closest ns at top level wins', function () {
      expect(
        nsFormUtil.nsFromCursorDoc(
          docFromTextNotation('(ns a) (fn [] {:rcf (comment\n(ns a-b.c-d))}|)')
        )
      ).toStrictEqual(['a', '(ns a)']);
      expect(
        nsFormUtil.nsFromCursorDoc(
          docFromTextNotation('(ns a) (ns b) (fn [] {:rcf (comment\n(ns a-b.c-d))|})')
        )
      ).toStrictEqual(['b', '(ns b)']);
      expect(
        nsFormUtil.nsFromCursorDoc(
          docFromTextNotation('(ns a) (ns b) (fn [] {:rcf (comment\n(ns a-b.c-d)|)})')
        )
      ).toStrictEqual(['a-b.c-d', '(ns a-b.c-d)']);
      expect(
        nsFormUtil.nsFromCursorDoc(
          docFromTextNotation('(fn [] {:rcf (comment\n(ns a-b.c-d))}) (ns a)|')
        )
      ).toStrictEqual(['a', '(ns a)']);
      expect(
        nsFormUtil.nsFromCursorDoc(
          docFromTextNotation('(fn [] {:rcf (comment\n(ns a-b.c-d))}) (ns a|)')
        )
      ).toStrictEqual(['a', '(ns a)']);
    });

    it('Closest ns or in-ns at top level wins', function () {
      expect(
        nsFormUtil.nsFromCursorDoc(
          docFromTextNotation("(ns a) (in-ns 'b) (fn [] {:rcf (comment\n(ns a-b.c-d))}|)")
        )
      ).toStrictEqual(['b', "(in-ns 'b)"]);
      expect(
        nsFormUtil.nsFromCursorDoc(
          docFromTextNotation("(in-ns 'a) (ns b) (fn [] {:rcf (comment\n(ns a-b.c-d))|})")
        )
      ).toStrictEqual(['b', '(ns b)']);
      expect(
        nsFormUtil.nsFromCursorDoc(
          docFromTextNotation("(ns a) (ns b) (fn [] {:rcf (comment\n(ns c) x (in-ns 'a-b.c-d)|)})")
        )
      ).toStrictEqual(['a-b.c-d', "(in-ns 'a-b.c-d)"]);
      expect(
        nsFormUtil.nsFromCursorDoc(
          docFromTextNotation("(fn [] {:rcf (comment\n(ns a-b.c-d))}) (in-ns 'a)|")
        )
      ).toStrictEqual(['a', "(in-ns 'a)"]);
      expect(
        nsFormUtil.nsFromCursorDoc(
          docFromTextNotation("(fn [] {:rcf (comment\n(ns a-b.c-d))}) (in-ns 'a|)")
        )
      ).toStrictEqual(['a', "(in-ns 'a)"]);
    });

    // TODO: Figure what to do with ignored forms
    //       For now, this is what they do (nothing)
    it('Finds ns in top level ignored form', function () {
      expect(nsFormUtil.nsFromCursorDoc(docFromTextNotation('#_ (ns a-b.c-d)|'))).toStrictEqual([
        'a-b.c-d',
        '(ns a-b.c-d)',
      ]);
    });
    it('Finds ns in ignored rich comments', function () {
      expect(
        nsFormUtil.nsFromCursorDoc(docFromTextNotation('#_ (comment\n(ns a-b.c-d)|)'))
      ).toStrictEqual(['a-b.c-d', '(ns a-b.c-d)']);
    });

    it('finds ns past top level id tokens', function () {
      expect(
        nsFormUtil.nsFromCursorDoc(docFromTextNotation('(ns a-b.c-d) (a b c) d e (f)|'))
      ).toStrictEqual(['a-b.c-d', '(ns a-b.c-d)']);
    });
    it('finds ns past top level id tokens from nested form', function () {
      expect(
        nsFormUtil.nsFromCursorDoc(docFromTextNotation('(ns a-b.c-d) (a b c) d e (f|)'))
      ).toStrictEqual(['a-b.c-d', '(ns a-b.c-d)']);
    });
    it('finds ns also when not first form', function () {
      expect(
        nsFormUtil.nsFromCursorDoc(docFromTextNotation('(foo bar)\n\n(ns a-b.c-d)|'))
      ).toStrictEqual(['a-b.c-d', '(ns a-b.c-d)']);
    });
    it('finds ns in rich comments', function () {
      expect(
        nsFormUtil.nsFromCursorDoc(docFromTextNotation('(ns a) (comment\n(ns b) (d e)|)'))
      ).toStrictEqual(['b', '(ns b)']);
    });
    it('finds ns in nested rich comments', function () {
      expect(
        nsFormUtil.nsFromCursorDoc(
          docFromTextNotation('(ns a) (fn [] {:rcf (comment\n(ns b) (c| d))})')
        )
      ).toStrictEqual(['b', '(ns b)']);
    });
    it('finds first ns form if at start of document', function () {
      expect(
        nsFormUtil.nsFromCursorDoc(docFromTextNotation('|(ns a) (a b c) (ns b)'))
      ).toStrictEqual(['a', '(ns a)']);
      expect(
        nsFormUtil.nsFromCursorDoc(docFromTextNotation('|(no-ns a) (a b c) (ns b) x (ns c) y'))
      ).toStrictEqual(['b', '(ns b)']);
      expect(
        nsFormUtil.nsFromCursorDoc(docFromTextNotation(' |(ns a) (a b c) (ns b)'))
      ).toStrictEqual(['a', '(ns a)']);
    });
    it('returns `null` if at start of document without ns form', function () {
      expect(nsFormUtil.nsFromCursorDoc(docFromTextNotation('|(no-ns a) (a b c) (no-ns b)'))).toBe(
        null
      );
    });

    // https://github.com/BetterThanTomorrow/calva/issues/2249
    it('returns outer ns if rich comment lacks ns', function () {
      expect(
        nsFormUtil.nsFromCursorDoc(docFromTextNotation('(ns a) (a b c) (comment b|)'))
      ).toStrictEqual(['a', '(ns a)']);
    });
    // https://github.com/BetterThanTomorrow/calva/issues/2266
    it('finds ns when symbol has metadata', function () {
      expect(
        nsFormUtil.nsFromCursorDoc(docFromTextNotation('(ns ^:no-doc a-b.c-d) (a b c)|'))
      ).toStrictEqual(['a-b.c-d', '(ns ^:no-doc a-b.c-d)']);
    });
    // https://github.com/BetterThanTomorrow/calva/issues/2309
    it('finds ns from inside ns form', function () {
      expect(
        nsFormUtil.nsFromCursorDoc(docFromTextNotation('(ns |a-b.c-d) (a b c)'))
      ).toStrictEqual(['a-b.c-d', '(ns a-b.c-d)']);
    });
    // https://github.com/BetterThanTomorrow/calva/issues/2299
    it('finds ns from unbalanced form, lacking opening brackets', function () {
      try {
        expect(
          nsFormUtil.nsFromCursorDoc(
            docFromTextNotation(
              '(ns xxx)•(def xxx|•{()"#"\\$" #"(?!\\w)"))))))))))))))))))))))))))))))))))))))))'
            )
          )
        ).toStrictEqual(['xxx', '(ns xxx)']);
      } catch (error) {
        fail(`Expected no error to be thrown, but got ${error}`);
      }
    });
    it('finds ns from unbalanced form lacking closing brackets', function () {
      try {
        expect(
          nsFormUtil.nsFromCursorDoc(docFromTextNotation('(ns xxx]))]]]]]])))•(def xxx|•{})'))
        ).toStrictEqual(['xxx', '(ns xxx]']);
      } catch (error) {
        fail(`Expected no error to be thrown, but got ${error}`);
      }
    });
    // https://github.com/BetterThanTomorrow/calva/issues/2523
    // (This wasn't the bug it seems, but it is a good test case.)
    it('returns null when no text in the document', function () {
      expect(nsFormUtil.nsFromCursorDoc(docFromTextNotation('|'))).toBe(null);
    });
  });

  describe('nsFromText', function () {
    it('defaults to `null`', function () {
      expect(nsFormUtil.nsFromText('(no-ns a-b.c-d)\nfoo')).toBe(null);
    });
    it('defaults to start from end', function () {
      expect(nsFormUtil.nsFromText('(ns a)\nfoo (ns b) bar')).toStrictEqual(['b', '(ns b)']);
    });
  });
});
