import * as expect from 'expect';
import { docFromTextNotation } from '../common/text-notation';
import * as nsFormUtil from '../../../util/ns-form';
import { resolveNsName, pathToNs, isPrefix } from '../../../util/ns-form';

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
    it('finds ns in simple form', function () {
      expect(nsFormUtil.nsFromCursorDoc(docFromTextNotation('(ns a-b.c-d) (a b c)|'))).toBe(
        'a-b.c-d'
      );
    });
    it('returns `null` if ns form does not contain a namespace symbol', function () {
      expect(nsFormUtil.nsFromCursorDoc(docFromTextNotation('(ns) (a b c)|'))).toBe(null);
    });
    it('returns `null` if ns form does contains non-symbol', function () {
      expect(nsFormUtil.nsFromCursorDoc(docFromTextNotation('(ns [a]) (a b c)|'))).toBe(null);
    });
    it('returns null if current enclosing form is ns form', function () {
      expect(nsFormUtil.nsFromCursorDoc(docFromTextNotation('(ns a-b.c-|d) (a b c)'))).toBe(null);
    });
    it('finds ns in form with line comment', function () {
      expect(nsFormUtil.nsFromCursorDoc(docFromTextNotation('(ns a-b.c-d ; comment\n)|'))).toBe(
        'a-b.c-d'
      );
    });
    it('finds ns in form after line comments', function () {
      expect(nsFormUtil.nsFromCursorDoc(docFromTextNotation('; comment\n(ns a-b.c-d)|'))).toBe(
        'a-b.c-d'
      );
    });

    it('Closest ns at top level wins', function () {
      expect(
        nsFormUtil.nsFromCursorDoc(
          docFromTextNotation('(ns a) (fn [] {:rcf (comment\n(ns a-b.c-d))}|)')
        )
      ).toBe('a');
      expect(
        nsFormUtil.nsFromCursorDoc(
          docFromTextNotation('(ns a) (ns b) (fn [] {:rcf (comment\n(ns a-b.c-d))|})')
        )
      ).toBe('b');
      expect(
        nsFormUtil.nsFromCursorDoc(
          docFromTextNotation('(ns a) (ns b) (fn [] {:rcf (comment\n(ns a-b.c-d)|)})')
        )
      ).toBe('a-b.c-d');
      expect(
        nsFormUtil.nsFromCursorDoc(
          docFromTextNotation('(fn [] {:rcf (comment\n(ns a-b.c-d))}) (ns a)|')
        )
      ).toBe('a');
      expect(
        nsFormUtil.nsFromCursorDoc(
          docFromTextNotation('(fn [] {:rcf (comment\n(ns a-b.c-d))}) (ns a|)')
        )
      ).toBe(null);
    });

    // TODO: Figure what to do with ignored forms
    //       For now, this is what they do (nothing)
    it('Finds ns in top level ignored form', function () {
      expect(nsFormUtil.nsFromCursorDoc(docFromTextNotation('#_ (ns a-b.c-d)|'))).toBe('a-b.c-d');
    });
    it('Finds ns in ignored rich comments', function () {
      expect(nsFormUtil.nsFromCursorDoc(docFromTextNotation('#_ (comment\n(ns a-b.c-d)|)'))).toBe(
        'a-b.c-d'
      );
    });

    it('finds ns past top level id tokens', function () {
      expect(nsFormUtil.nsFromCursorDoc(docFromTextNotation('(ns a-b.c-d) (a b c) d e (f)|'))).toBe(
        'a-b.c-d'
      );
    });
    it('finds ns past top level id tokens from nested form', function () {
      expect(nsFormUtil.nsFromCursorDoc(docFromTextNotation('(ns a-b.c-d) (a b c) d e (f|)'))).toBe(
        'a-b.c-d'
      );
    });
    it('finds ns also when not first form', function () {
      expect(nsFormUtil.nsFromCursorDoc(docFromTextNotation('(foo bar)\n\n(ns a-b.c-d)|'))).toBe(
        'a-b.c-d'
      );
    });
    it('finds ns in rich comments', function () {
      expect(
        nsFormUtil.nsFromCursorDoc(docFromTextNotation('(ns a) (comment\n(ns b) (d e)|)'))
      ).toBe('b');
    });
    it('finds ns in nested rich comments', function () {
      expect(
        nsFormUtil.nsFromCursorDoc(
          docFromTextNotation('(ns a) (fn [] {:rcf (comment\n(ns b) (c| d))})')
        )
      ).toBe('b');
    });
  });

  describe('nsFromText', function () {
    it('defaults to `null`', function () {
      expect(nsFormUtil.nsFromText('(no-ns a-b.c-d)\nfoo')).toBe(null);
    });
    it('defaults to start from end', function () {
      expect(nsFormUtil.nsFromText('(ns a)\nfoo (ns b) bar')).toBe('b');
    });
  });
});
