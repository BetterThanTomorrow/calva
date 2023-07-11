import * as expect from 'expect';
import * as nsFormUtil from '../../../util/ns-form';
import { resolveNsName, pathToNs, isPrefix } from '../../../util/ns-form';

describe('test ns-form util', () => {
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

  describe('nsFromText', function () {
    it('finds ns in simple form', function () {
      expect(nsFormUtil.nsFromText('(ns a-b.c-d)')).toBe('a-b.c-d');
    });
    it('finds ns also when not first form', function () {
      expect(nsFormUtil.nsFromText('(foo bar)\n\n(ns a-b.c-d)')).toBe('a-b.c-d');
    });
    it('finds ns in form with line comment', function () {
      expect(nsFormUtil.nsFromText('(ns a-b.c-d ; comment\n)')).toBe('a-b.c-d');
    });
    it('finds ns in form with line comment and metadata', function () {
      expect(nsFormUtil.nsFromText('(ns ^{:author "me"} a-b.c-d ; comment\n)')).toBe('a-b.c-d');
    });
    it('finds ns in form after line comments', function () {
      expect(nsFormUtil.nsFromText('; comment\n(ns a-b.c-d)')).toBe('a-b.c-d');
    });

    // TODO: Figure if we want to support these
    it('finds ns in rich comments', function () {
      expect(nsFormUtil.nsFromText('(comment\n(ns a-b.c-d))')).toBe('a-b.c-d');
    });
    it('finds ns in ignored form', function () {
      expect(nsFormUtil.nsFromText('#_ (ns a-b.c-d)')).toBe('a-b.c-d');
    });
    it('finds ns in ignored rich comments', function () {
      expect(nsFormUtil.nsFromText('#_ (comment\n(ns a-b.c-d))')).toBe('a-b.c-d');
    });
  });
});
