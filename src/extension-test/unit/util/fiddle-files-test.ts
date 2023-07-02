import * as expect from 'expect';
import * as fs from 'fs';
import * as fiddleFiles from '../../../util/fiddle-files';

describe('fiddle files', () => {
  describe('context', () => {
    it('without source->fiddle map, a .fiddle files is fiddle file', function () {
      expect(fiddleFiles.isFiddleFile('/u/p/src/a/b/c_d.fiddle', '/u/p', null)).toBeTruthy();
    });
    it('without source->fiddle map, all .fiddle files are fiddle files, also outside the project root', function () {
      expect(fiddleFiles.isFiddleFile('/u/p/src/a/b/c_d.fiddle', '/z/p', null)).toBeTruthy();
    });
    it('with fiddle->source map, a .cljc file in the fiddle path is fiddle file', function () {
      expect(
        fiddleFiles.isFiddleFile('/u/p/dev/fiddles/a/b/c_d.cljc', '/u/p', [
          { source: ['src'], fiddle: ['dev', 'fiddles'] },
        ])
      ).toBeTruthy();
    });
    it('with fiddle->source map, a .fiddle file in the fiddle path is a fiddle file', function () {
      expect(
        fiddleFiles.isFiddleFile('/u/p/dev/fiddles/a/b/c_d.fiddle', '/u/p', [
          { source: ['src'], fiddle: ['dev', 'fiddles'] },
        ])
      ).toBeTruthy();
    });
    it('with fiddle->source map, any file fiddle path is a fiddle file', function () {
      expect(
        fiddleFiles.isFiddleFile('/u/p/dev/fiddles/a/b/c/d.anything', '/u/p', [
          { source: ['src'], fiddle: ['dev', 'fiddles'] },
        ])
      ).toBeTruthy();
    });
    it('with fiddle->source map, a .cljc file not in the fiddle path is not a fiddle file', function () {
      expect(
        fiddleFiles.isFiddleFile('/u/p/src/a/b/c_d.cljc', '/u/p', [
          { source: ['src'], fiddle: ['dev', 'fiddles'] },
        ])
      ).toBeFalsy();
    });
    it('with multiple fiddle->source mappings, a file in any of the fiddle paths is a fiddle file', function () {
      expect(
        fiddleFiles.isFiddleFile('/u/p/dev/fiddles/a/b/c_d.cljc', '/u/p', [
          { source: ['no-match'], fiddle: ['no-fiddle'] },
          { source: ['src'], fiddle: ['dev', 'fiddles'] },
          { source: ['src'], fiddle: ['second'] },
        ])
      ).toBeTruthy();
    });
  });

  describe('fiddle file for source', () => {
    it('without source->fiddle map, gets fiddle file for cljc file', function () {
      expect(fiddleFiles.getFiddleForSourceFile('/u/p/src/a/b/c_d.cljc', '/u/p', null)).toBe(
        '/u/p/src/a/b/c_d.fiddle'
      );
    });
    it('with source->fiddle map, gets fiddle file for cljc file', function () {
      expect(
        fiddleFiles.getFiddleForSourceFile('/u/p/src/a/b/c_d.cljc', '/u/p', [
          { source: ['src'], fiddle: ['dev', 'fiddles'] },
        ])
      ).toBe('/u/p/dev/fiddles/a/b/c_d.cljc');
    });
    it('with source->fiddle map with several matching source mappings, gets fiddle file for first', function () {
      expect(
        fiddleFiles.getFiddleForSourceFile('/u/p/src/a/b/c_d.cljc', '/u/p', [
          { source: ['no-match'], fiddle: ['no-fiddle'] },
          { source: ['src'], fiddle: ['first'] },
          { source: ['src'], fiddle: ['second'] },
        ])
      ).toBe('/u/p/first/a/b/c_d.cljc');
    });
    it('throws when no source mapping', function () {
      expect(() =>
        fiddleFiles.getFiddleForSourceFile('/u/p/src/a/b/c_d.cljc', '/u/p', [
          { source: ['no-match'], fiddle: ['no-fiddle'] },
        ])
      ).toThrow(fiddleFiles.FiddleMappingException);
    });
    it('throws when project root does not match', function () {
      expect(() =>
        fiddleFiles.getFiddleForSourceFile('/u/p/src/a/b/c_d.cljc', '/u/p-no', [
          { source: ['no-match'], fiddle: ['no-fiddle'] },
          { source: ['src'], fiddle: ['first'] },
          { source: ['src'], fiddle: ['second'] },
        ])
      ).toThrow(fiddleFiles.FiddleMappingException);
    });
  });

  describe('source for fiddle file', () => {
    describe('source base', () => {
      it('without fiddle->source map, gets source base for fiddle file', function () {
        expect(
          fiddleFiles.getSourceBaseForFiddleFile('/u/p/src/a/b/c_d.fiddle', '/u/p', null)
        ).toBe('/u/p/src/a/b/c_d');
      });
      it('with fiddle->source map, gets source base for fiddle file', function () {
        expect(
          fiddleFiles.getSourceBaseForFiddleFile('/u/p/dev/fiddles/a/b/c_d.clj', '/u/p', [
            { source: ['src'], fiddle: ['dev', 'fiddles'] },
          ])
        ).toBe('/u/p/src/a/b/c_d');
      });
      it('with fiddle->source map with several matching source mappings, gets fiddle file for first', function () {
        expect(
          fiddleFiles.getSourceBaseForFiddleFile('/u/p/dev/fiddles/a/b/c_d.cljc', '/u/p', [
            { source: ['no-source'], fiddle: ['no-match'] },
            { source: ['first'], fiddle: ['dev', 'fiddles'] },
            { source: ['second'], fiddle: ['dev', 'fiddles'] },
          ])
        ).toBe('/u/p/first/a/b/c_d');
      });
      it('throws when no fiddle mapping', function () {
        expect(() =>
          fiddleFiles.getSourceBaseForFiddleFile('/u/p/dev/fiddles/a/b/c_d.fiddle', '/u/p', [
            { source: ['no-source'], fiddle: ['no-match'] },
          ])
        ).toThrow(fiddleFiles.FiddleMappingException);
      });
      it('throws when project root does not match', function () {
        expect(() =>
          fiddleFiles.getSourceBaseForFiddleFile('/u/p/dev/fiddles/a/b/c_d.cljc', '/u/p-no', [
            { source: ['no-source'], fiddle: ['no-match'] },
            { source: ['first'], fiddle: ['dev', 'fiddles'] },
            { source: ['second'], fiddle: ['dev', 'fiddles'] },
          ])
        ).toThrow(fiddleFiles.FiddleMappingException);
      });
    });

    describe('source file', () => {
      const mockWorkspace: fiddleFiles.Workspace = {
        findFiles: (pattern: string) => {
          return Promise.resolve([
            { fsPath: '/u/p/src/a/b/c_d.clj' },
            { fsPath: '/u/p/src/a/b/c_d.cljc' },
          ]);
        },
      };
      it('without fiddle->source map, gets cljc source file for fiddle file', async function () {
        expect(
          await fiddleFiles.getSourceForFiddleFile(
            '/u/p/src/a/b/c_d.fiddle',
            '/u/p',
            null,
            mockWorkspace,
            ['cljc', 'clj']
          )
        ).toBe('/u/p/src/a/b/c_d.cljc');
      });
      it('with fiddle->source map, gets source clj for clj fiddle file', async function () {
        expect(
          await fiddleFiles.getSourceForFiddleFile(
            '/u/p/dev/fiddles/a/b/c_d.clj',
            '/u/p',
            [{ source: ['src'], fiddle: ['dev', 'fiddles'] }],
            mockWorkspace
          )
        ).toBe('/u/p/src/a/b/c_d.clj');
      });
      it('with fiddle->source map, gets source bb for bb fiddle file', async function () {
        expect(
          await fiddleFiles.getSourceForFiddleFile(
            '/u/p/dev/fiddles/a/b/c_d.bb',
            '/u/p',
            [{ source: ['src'], fiddle: ['dev', 'fiddles'] }],
            mockWorkspace
          )
        ).toBe('/u/p/src/a/b/c_d.bb');
      });
    });
  });
});
