import { expect } from 'expect';
import * as path from 'path';
import * as fileArg from '../../util/resolve-file-arg';

describe('resolveFilePath', () => {
  const workspaceRoot = '/workspace/project';

  describe('null/undefined/empty arguments', () => {
    it('returns undefined for null', () => {
      expect(fileArg.resolveFilePath(null, workspaceRoot)).toBeUndefined();
    });

    it('returns undefined for undefined', () => {
      expect(fileArg.resolveFilePath(undefined, workspaceRoot)).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
      expect(fileArg.resolveFilePath('', workspaceRoot)).toBeUndefined();
    });

    it('returns undefined for empty array', () => {
      expect(fileArg.resolveFilePath([], workspaceRoot)).toBeUndefined();
    });
  });

  describe('URI-like objects', () => {
    it('extracts fsPath from a URI-like object with scheme', () => {
      const uri = { scheme: 'file', fsPath: '/some/file.clj' };
      expect(fileArg.resolveFilePath(uri, workspaceRoot)).toBe('/some/file.clj');
    });

    it('returns undefined if URI-like has no fsPath', () => {
      const uri = { scheme: 'file' };
      expect(fileArg.resolveFilePath(uri, workspaceRoot)).toBeUndefined();
    });
  });

  describe('string arguments', () => {
    it('returns absolute path as-is', () => {
      expect(fileArg.resolveFilePath('/absolute/path/foo.clj', workspaceRoot)).toBe(
        '/absolute/path/foo.clj'
      );
    });

    it('resolves relative path against workspace root', () => {
      expect(fileArg.resolveFilePath('src/foo.clj', workspaceRoot)).toBe(
        path.join(workspaceRoot, 'src/foo.clj')
      );
    });

    it('returns undefined for relative path without workspace root', () => {
      expect(fileArg.resolveFilePath('src/foo.clj', undefined)).toBeUndefined();
    });
  });

  describe('string array arguments', () => {
    it('joins and returns absolute segments', () => {
      expect(fileArg.resolveFilePath(['/absolute', 'path', 'foo.clj'], workspaceRoot)).toBe(
        path.join('/absolute', 'path', 'foo.clj')
      );
    });

    it('joins relative segments and resolves against workspace root', () => {
      expect(fileArg.resolveFilePath(['src', 'foo.clj'], workspaceRoot)).toBe(
        path.join(workspaceRoot, 'src', 'foo.clj')
      );
    });

    it('returns undefined for relative segments without workspace root', () => {
      expect(fileArg.resolveFilePath(['src', 'foo.clj'], undefined)).toBeUndefined();
    });

    it('rejects arrays with non-string elements', () => {
      expect(fileArg.resolveFilePath(['src', 42 as any], workspaceRoot)).toBeUndefined();
    });
  });

  describe('unsupported argument types', () => {
    it('returns undefined for a plain object without scheme', () => {
      expect(fileArg.resolveFilePath({ foo: 'bar' }, workspaceRoot)).toBeUndefined();
    });

    it('returns undefined for a number', () => {
      expect(fileArg.resolveFilePath(42, workspaceRoot)).toBeUndefined();
    });

    it('returns undefined for a boolean', () => {
      expect(fileArg.resolveFilePath(true, workspaceRoot)).toBeUndefined();
    });
  });
});
