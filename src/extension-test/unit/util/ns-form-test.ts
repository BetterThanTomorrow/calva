import * as expect from 'expect';
import { resolveNsName, pathToNs, isPrefix } from '../../../util/ns-form';

describe('test ns-form util', () => {
    describe('isPrefix', function () {
        it('/app/src is prefix', function () {
            expect(true).toBe(isPrefix('/app/src', '/app/src/app/file.clj'));
        });
        it('/app/resource is not prefix', function () {
            expect(false).toBe(
                isPrefix('/app/resource', '/app/src/app/file.clj')
            );
        });
    });

    describe('pathToNs', function () {
        it('test_file.clj', function () {
            expect('test-file').toBe(pathToNs('test_file.clj'));
        });
        it('foo/bar/baz/test_file.clj', function () {
            expect('foo.bar.baz.test-file').toBe(
                pathToNs('foo/bar/baz/test_file.clj')
            );
        });
        it('foo_bar_baz/test_file.clj', function () {
            expect('foo-bar-baz.test-file').toBe(
                pathToNs('foo_bar_baz/test_file.clj')
            );
        });
    });

    describe('resolveNsName', function () {
        it('with source paths', function () {
            expect('app.file').toBe(
                resolveNsName(['/app/src'], '/app/src/app/file.clj')
            );
        });
        it('with empty source paths', function () {
            expect('empty-src').toBe(
                resolveNsName([], '/app/src/app/empty_src.clj')
            );
        });
        it('with source paths (not found)', function () {
            expect('file-test').toBe(
                resolveNsName(['/app/src'], '/app/test/app/file_test.clj')
            );
        });
    });
});
