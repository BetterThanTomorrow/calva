import * as expect from 'expect';
import * as fiddleFiles from '../../../util/fiddle-files';
import * as path from 'path';

describe('fiddle files', () => {
  describe('mapping', () => {
    describe('source->fiddle', () => {
      it('finds mapping', function () {
        expect(
          fiddleFiles._internal_getMapping(
            [{ source: ['src'], fiddle: ['dev'] }],
            path.join('u', 'p'),
            path.join('u', 'p', 'src', 'a', 'b', 'c_d.clj'),
            'source'
          ).fiddle
        ).toEqual(['dev']);
      });
      it('finds first matching mapping', function () {
        expect(
          fiddleFiles._internal_getMapping(
            [
              { source: ['no-src'], fiddle: ['no-dev'] },
              { source: ['src'], fiddle: ['first-dev'] },
              { source: ['src'], fiddle: ['second-dev'] },
            ],
            path.join('u', 'p'),
            path.join('u', 'p', 'src', 'a', 'b', 'c_d.clj'),
            'source'
          ).fiddle
        ).toEqual(['first-dev']);
      });
      it('finds first matching mapping, considering full path segments', function () {
        expect(
          fiddleFiles._internal_getMapping(
            [
              { source: ['no-src'], fiddle: ['no-dev'] },
              { source: ['src'], fiddle: ['not-first-dev'] },
              { source: ['src2'], fiddle: ['first-dev'] },
            ],
            path.join('u', 'p'),
            path.join('u', 'p', 'src2', 'a', 'b', 'c_d.clj'),
            'source'
          ).fiddle
        ).toEqual(['first-dev']);
      });
      it('prioritizes the longest source mapping, when overlapping', function () {
        expect(
          fiddleFiles._internal_getMapping(
            [
              { source: ['src'], fiddle: ['not-prio'] },
              { source: ['src', 'a'], fiddle: ['prio'] },
            ],
            path.join('u', 'p'),
            path.join('u', 'p', 'src/a/b.cljs'),
            'source'
          ).fiddle
        ).toEqual(['prio']);
      });
      it('prioritizes the longest source mapping, when overlapping, even if the shorter is an dedicated fiddle', function () {
        expect(
          fiddleFiles._internal_getMapping(
            [
              { source: ['src'], fiddle: ['a.fiddle'] },
              { source: ['src', 'a'], fiddle: ['prio'] },
            ],
            path.join('u', 'p'),
            path.join('u', 'p', 'src/a/b.cljs'),
            'source'
          ).fiddle
        ).toEqual(['prio']);
      });
      it('only considers matching path', function () {
        expect(
          fiddleFiles._internal_getMapping(
            [
              { source: ['src'], fiddle: ['a.fiddle'] },
              { source: ['src', 'a'], fiddle: ['not-matching'] },
            ],
            path.join('u', 'p'),
            path.join('u', 'p', 'src', 'b', 'b.cljs'),
            'source'
          ).fiddle
        ).toEqual(['a.fiddle']);
      });
      it('prioritizes dedicated fiddle when equal length from mappings', function () {
        expect(
          fiddleFiles._internal_getMapping(
            [
              { source: ['src'], fiddle: ['dev'] },
              { source: ['src'], fiddle: ['dev', 'a.ext'] },
              { source: ['src'], fiddle: ['dev', 'b'] },
            ],
            path.join('u', 'p'),
            path.join('u', 'p', 'src', 'a', 'b', 'c.clj'),
            'source'
          ).fiddle
        ).toEqual(['dev', 'a.ext']);
      });
      it('prioritizes first dedicated fiddle when equal length from mappings', function () {
        expect(
          fiddleFiles._internal_getMapping(
            [
              { source: ['no-match'], fiddle: ['no-fiddle'] },
              { source: ['src'], fiddle: ['no-fiddle'] },
              { source: ['src2'], fiddle: ['first.ext'] },
              { source: ['src2'], fiddle: ['second.ext'] },
            ],
            path.join('u', 'p'),
            path.join('u', 'p', 'src2', 'a', 'b', 'c.clj'),
            'source'
          ).fiddle
        ).toEqual(['first.ext']);
      });
      it('prioritizes first dedicated fiddle when equal length from mappings', function () {
        expect(
          fiddleFiles._internal_getMapping(
            [
              { source: ['no-match'], fiddle: ['no-fiddle'] },
              { source: ['src'], fiddle: ['first'] },
              { source: ['src'], fiddle: ['second.ext'] },
            ],
            path.join('u', 'p'),
            path.join('u', 'p', 'src', 'a', 'b', 'c.clj'),
            'source'
          ).fiddle
        ).toEqual(['second.ext']);
      });
      it('prioritizes dedicated fiddle match with the same file extension', function () {
        expect(
          fiddleFiles._internal_getMapping(
            [
              { source: ['not-prio'], fiddle: ['dev'] },
              { source: ['src'], fiddle: ['dev', 'a.clj'] },
              { source: ['src'], fiddle: ['dev', 'a.cljc'] },
              { source: ['src'], fiddle: ['dev', 'a.cljs'] },
            ],
            path.join('u', 'p'),
            path.join('u', 'p', 'src', 'a', 'b', 'c.cljs'),
            'source'
          ).fiddle
        ).toEqual(['dev', 'a.cljs']);
        expect(
          fiddleFiles._internal_getMapping(
            [
              { source: ['not-prio'], fiddle: ['dev'] },
              { source: ['src'], fiddle: ['dev', 'a.clj'] },
              { source: ['src'], fiddle: ['dev', 'a.cljc'] },
              { source: ['src'], fiddle: ['dev', 'a.cljs'] },
            ],
            path.join('u', 'p'),
            path.join('u', 'p', 'src', 'a', 'b', 'c.clj'),
            'source'
          ).fiddle
        ).toEqual(['dev', 'a.clj']);
        expect(
          fiddleFiles._internal_getMapping(
            [
              { source: ['not-prio'], fiddle: ['dev'] },
              { source: ['src'], fiddle: ['dev', 'a.clj'] },
              { source: ['src'], fiddle: ['dev', 'a.cljc'] },
              { source: ['src'], fiddle: ['dev', 'a.cljs'] },
            ],
            path.join('u', 'p'),
            path.join('u', 'p', 'src', 'a', 'b', 'c.cljc'),
            'source'
          ).fiddle
        ).toEqual(['dev', 'a.cljc']);
        expect(
          fiddleFiles._internal_getMapping(
            [
              { source: ['not-prio'], fiddle: ['dev'] },
              { source: ['src'], fiddle: ['dev', 'a.clj'] },
              { source: ['src'], fiddle: ['dev', 'a.cljc'] },
              { source: ['src'], fiddle: ['dev', 'a.cljs'] },
            ],
            path.join('u', 'p'),
            path.join('u', 'p', 'src', 'a', 'b', 'c.bb'),
            'source'
          ).fiddle
        ).toEqual(['dev', 'a.clj']);
      });
    });

    describe('fiddle->source', () => {
      it('finds mapping', function () {
        expect(
          fiddleFiles._internal_getMapping(
            [{ source: ['src'], fiddle: ['dev'] }],
            path.join('u', 'p'),
            path.join('u', 'p', 'dev', 'a', 'b', 'c_d.fiddle'),
            'fiddle'
          ).source
        ).toEqual(['src']);
      });
      it('finds first mapping', function () {
        expect(
          fiddleFiles._internal_getMapping(
            [
              { source: ['no-src'], fiddle: ['no-dev'] },
              { source: ['first-src'], fiddle: ['dev'] },
              { source: ['second-src'], fiddle: ['dev'] },
            ],
            path.join('u', 'p'),
            path.join('u', 'p', 'dev', 'a', 'b', 'c_d.fiddle'),
            'fiddle'
          ).source
        ).toEqual(['first-src']);
      });
      it('finds first mapping, considering full path segments', function () {
        expect(
          fiddleFiles._internal_getMapping(
            [
              { source: ['no-src'], fiddle: ['no-dev'] },
              { source: ['not-first-src'], fiddle: ['dev'] },
              { source: ['first-src'], fiddle: ['dev2'] },
            ],
            path.join('u', 'p'),
            path.join('u', 'p', 'dev2', 'a', 'b', 'c_d.fiddle'),
            'fiddle'
          ).source
        ).toEqual(['first-src']);
      });
      it('prioritizes the longest fiddle mapping, when overlapping', function () {
        expect(
          fiddleFiles._internal_getMapping(
            [
              { source: ['src'], fiddle: ['dev', 'fiddles'] },
              { source: ['prio'], fiddle: ['dev', 'fiddles', 'a'] },
            ],
            path.join('u', 'p'),
            path.join('u', 'p', 'dev', 'fiddles', 'a', 'b.cljs'),
            'fiddle'
          ).source
        ).toEqual(['prio']);
      });
      it('prioritizes dedicated fiddle match', function () {
        expect(
          fiddleFiles._internal_getMapping(
            [
              { source: ['not-prio'], fiddle: ['dev'] },
              { source: ['first-src'], fiddle: ['dev', 'a.ext'] },
            ],
            path.join('u', 'p'),
            path.join('u', 'p', 'dev', 'a.ext'),
            'fiddle'
          ).source
        ).toEqual(['first-src']);
      });
      it('prioritizes dedicated fiddle match with the same file extension', function () {
        expect(
          fiddleFiles._internal_getMapping(
            [
              { source: ['not-prio'], fiddle: ['dev'] },
              { source: ['clj'], fiddle: ['dev', 'a.clj'] },
              { source: ['cljc'], fiddle: ['dev', 'a.cljc'] },
              { source: ['cljs'], fiddle: ['dev', 'a.cljs'] },
            ],
            path.join('u', 'p'),
            path.join('u', 'p', 'dev', 'a.cljs'),
            'fiddle'
          ).source
        ).toEqual(['cljs']);
        expect(
          fiddleFiles._internal_getMapping(
            [
              { source: ['not-prio'], fiddle: ['dev'] },
              { source: ['clj'], fiddle: ['dev', 'a.clj'] },
              { source: ['cljc'], fiddle: ['dev', 'a.cljc'] },
              { source: ['cljs'], fiddle: ['dev', 'a.cljs'] },
            ],
            path.join('u', 'p'),
            path.join('u', 'p', 'dev', 'a.clj'),
            'fiddle'
          ).source
        ).toEqual(['clj']);
        expect(
          fiddleFiles._internal_getMapping(
            [
              { source: ['not-prio'], fiddle: ['dev'] },
              { source: ['clj'], fiddle: ['dev', 'a.clj'] },
              { source: ['cljc'], fiddle: ['dev', 'a.cljc'] },
              { source: ['cljs'], fiddle: ['dev', 'a.cljs'] },
            ],
            path.join('u', 'p'),
            path.join('u', 'p', 'dev', 'a.cljc'),
            'fiddle'
          ).source
        ).toEqual(['cljc']);
      });
      it('prioritizes longest from mapping, even when the shorter is an dedicated fiddle', function () {
        expect(
          fiddleFiles._internal_getMapping(
            [
              { source: ['not-prio'], fiddle: ['dev'] },
              { source: ['dedicated'], fiddle: ['dev', 'a', 'a.ext'] },
              { source: ['prio'], fiddle: ['dev', 'a', 'b'] },
            ],
            path.join('u', 'p'),
            path.join('u', 'p', 'dev', 'a', 'b', 'c.clj'),
            'fiddle'
          ).source
        ).toEqual(['prio']);
      });
    });
  });

  describe('context', () => {
    it('without source->fiddle map, a .fiddle files is fiddle file', function () {
      expect(
        fiddleFiles.isFiddleFile(
          path.join('u', 'p', 'src', 'a', 'b', 'c_d.fiddle'),
          path.join('u', 'p'),
          null
        )
      ).toBeTruthy();
    });
    it('without source->fiddle map, all .fiddle files are fiddle files, also outside the project root', function () {
      expect(
        fiddleFiles.isFiddleFile(
          path.join('u', 'p', 'src', 'a', 'b', 'c_d.fiddle'),
          path.join('z', 'p'),
          null
        )
      ).toBeTruthy();
    });
    it('with fiddle->source map, a .cljc file in the fiddle path is fiddle file', function () {
      expect(
        fiddleFiles.isFiddleFile(
          path.join('u', 'p', 'dev', 'fiddles', 'a', 'b', 'c_d.cljc'),
          path.join('u', 'p'),
          [{ source: ['src'], fiddle: ['dev', 'fiddles'] }]
        )
      ).toBeTruthy();
    });
    it('with fiddle->source map, a .fiddle file in the fiddle path is a fiddle file', function () {
      expect(
        fiddleFiles.isFiddleFile(
          path.join('u', 'p', 'dev', 'fiddles', 'a', 'b', 'c_d.fiddle'),
          path.join('u', 'p'),
          [{ source: ['src'], fiddle: ['dev', 'fiddles'] }]
        )
      ).toBeTruthy();
    });
    it('with fiddle->source map, a .fiddle file in the source path is a fiddle file', function () {
      expect(
        fiddleFiles.isFiddleFile(
          path.join('u', 'p', 'src', 'a', 'b', 'c_d.fiddle'),
          path.join('u', 'p'),
          [{ source: ['src'], fiddle: ['dev', 'fiddles'] }]
        )
      ).toBeTruthy();
    });
    it('with fiddle->source map, any file fiddle path is a fiddle file', function () {
      expect(
        fiddleFiles.isFiddleFile(
          path.join('u', 'p', 'dev', 'fiddles', 'a', 'b', 'c', 'd.anything'),
          path.join('u', 'p'),
          [{ source: ['src'], fiddle: ['dev', 'fiddles'] }]
        )
      ).toBeTruthy();
    });
    it('with fiddle->source map, a .cljc file not in the fiddle path is not a fiddle file', function () {
      expect(
        fiddleFiles.isFiddleFile(
          path.join('u', 'p', 'src', 'a', 'b', 'c_d.cljc'),
          path.join('u', 'p'),
          [{ source: ['src'], fiddle: ['dev', 'fiddles'] }]
        )
      ).toBeFalsy();
    });
    it('with fiddle->source map ending with a file extension, the exact match is a dedicated fiddle file', function () {
      expect(
        fiddleFiles.isFiddleFile(
          path.join('u', 'p', 'dev', 'fiddles', 'a.ext'),
          path.join('u', 'p'),
          [{ source: ['src'], fiddle: ['dev', 'fiddles', 'a.ext'] }]
        )
      ).toBeTruthy();
    });
    it('with multiple fiddle->source mappings, a file in any of the fiddle paths is a fiddle file', function () {
      expect(
        fiddleFiles.isFiddleFile(
          path.join('u', 'p', 'dev', 'fiddles', 'a', 'b', 'c_d.cljc'),
          path.join('u', 'p'),
          [
            { source: ['no-match'], fiddle: ['no-fiddle'] },
            { source: ['src'], fiddle: ['dev', 'fiddles'] },
            { source: ['src'], fiddle: ['second'] },
          ]
        )
      ).toBeTruthy();
    });
    it('with fiddle->source map ending with a file extension,  a non-matching file is not a fiddle file', function () {
      expect(
        fiddleFiles.isFiddleFile(
          path.join('u', 'p', 'dev', 'fiddles', 'b.ext'),
          path.join('u', 'p'),
          [{ source: ['src'], fiddle: ['dev', 'fiddles', 'a.ext'] }]
        )
      ).toBeFalsy();
      expect(
        fiddleFiles.isFiddleFile(
          path.join('u', 'p', 'src', 'a', 'b', 'c.clj'),
          path.join('u', 'p'),
          [{ source: ['src'], fiddle: ['dev', 'fiddles', 'a.ext'] }]
        )
      ).toBeFalsy();
    });
  });

  describe('fiddle file for source', () => {
    it('without source->fiddle map, gets fiddle file for cljc file', function () {
      expect(
        fiddleFiles.getFiddleForSourceFile(
          path.join('u', 'p', 'src', 'a', 'b', 'c_d.cljc'),
          path.join('u', 'p'),
          null
        )
      ).toBe(path.join('u', 'p', 'src', 'a', 'b', 'c_d.fiddle'));
    });
    it('with source->fiddle map, gets fiddle file for cljc file', function () {
      expect(
        fiddleFiles.getFiddleForSourceFile(
          path.join('u', 'p', 'src', 'a', 'b', 'c_d.cljc'),
          path.join('u', 'p'),
          [{ source: ['src'], fiddle: ['dev', 'fiddles'] }]
        )
      ).toBe(path.join('u', 'p', 'dev', 'fiddles', 'a', 'b', 'c_d.cljc'));
    });
    it('with source->fiddle map with several matching source mappings, gets fiddle file for first', function () {
      expect(
        fiddleFiles.getFiddleForSourceFile(
          path.join('u', 'p', 'src', 'a', 'b', 'c_d.cljc'),
          path.join('u', 'p'),
          [
            { source: ['no-match'], fiddle: ['no-fiddle'] },
            { source: ['src'], fiddle: ['first'] },
            { source: ['src'], fiddle: ['second'] },
          ]
        )
      ).toBe(path.join('u', 'p', 'first', 'a', 'b', 'c_d.cljc'));
    });
    it('with source->fiddle map with fiddle path ending in a file extension, finds that file for any source file', function () {
      expect(
        fiddleFiles.getFiddleForSourceFile(
          path.join('u', 'p', 'src', 'a', 'b', 'c_d.cljc'),
          path.join('u', 'p'),
          [{ source: ['src'], fiddle: ['dev', 'fiddles', 'a.ext'] }]
        )
      ).toBe(path.join('u', 'p', 'dev', 'fiddles', 'a.ext'));
      expect(
        fiddleFiles.getFiddleForSourceFile(
          path.join('u', 'p', 'src', 'a', 'b.cljc'),
          path.join('u', 'p'),
          [{ source: ['src'], fiddle: ['dev', 'fiddles', 'a.ext'] }]
        )
      ).toBe(path.join('u', 'p', 'dev', 'fiddles', 'a.ext'));
    });
    it('with source->fiddle map with several matching source mappings, gets fiddle file for first, also if it is an dedicated fiddle', function () {
      expect(
        fiddleFiles.getFiddleForSourceFile(
          path.join('u', 'p', 'src', 'a', 'b', 'c_d.cljc'),
          path.join('u', 'p'),
          [
            { source: ['no-match'], fiddle: ['no-fiddle'] },
            { source: ['src'], fiddle: ['first.ext'] },
            { source: ['src'], fiddle: ['second'] },
          ]
        )
      ).toBe(path.join('u', 'p', 'first.ext'));
      expect(
        fiddleFiles.getFiddleForSourceFile(
          path.join('u', 'p', 'src2', 'a', 'b', 'c_d.cljc'),
          path.join('u', 'p'),
          [
            { source: ['no-match'], fiddle: ['no-fiddle'] },
            { source: ['src'], fiddle: ['no-fiddle'] },
            { source: ['src2'], fiddle: ['first.ext'] },
            { source: ['src2'], fiddle: ['second.ext'] },
          ]
        )
      ).toBe(path.join('u', 'p', 'first.ext'));
    });
    it('with source->fiddle map with several matching source mappings, gets dedicated', function () {
      expect(
        fiddleFiles.getFiddleForSourceFile(
          path.join('u', 'p', 'src', 'a', 'b', 'c_d.cljc'),
          path.join('u', 'p'),
          [
            { source: ['no-match'], fiddle: ['no-fiddle'] },
            { source: ['src'], fiddle: ['first'] },
            { source: ['src'], fiddle: ['second.ext'] },
          ]
        )
      ).toBe(path.join('u', 'p', 'second.ext'));
    });
    it('throws when no source mapping', function () {
      expect(() =>
        fiddleFiles.getFiddleForSourceFile(
          path.join('u', 'p', 'src', 'a', 'b', 'c_d.cljc'),
          path.join('u', 'p'),
          [{ source: ['no-match'], fiddle: ['no-fiddle'] }]
        )
      ).toThrow(fiddleFiles.FiddleMappingException);
    });
    it('throws when project root does not match', function () {
      expect(() =>
        fiddleFiles.getFiddleForSourceFile(
          path.join('u', 'p', 'src', 'a', 'b', 'c_d.cljc'),
          path.join('u', 'p-no'),
          [
            { source: ['no-match'], fiddle: ['no-fiddle'] },
            { source: ['src'], fiddle: ['first'] },
            { source: ['src'], fiddle: ['second'] },
          ]
        )
      ).toThrow(fiddleFiles.FiddleMappingException);
    });
  });

  describe('source for fiddle file', () => {
    describe('source base', () => {
      it('without fiddle->source map, gets source base for fiddle file', function () {
        expect(
          fiddleFiles.getSourceBaseForFiddleFile(
            path.join('u', 'p', 'src', 'a', 'b', 'c_d.fiddle'),
            path.join('u', 'p'),
            null
          )
        ).toBe(path.join('u', 'p', 'src', 'a', 'b', 'c_d'));
      });
      it('with fiddle->source map, gets source base for fiddle file', function () {
        expect(
          fiddleFiles.getSourceBaseForFiddleFile(
            path.join('u', 'p', 'dev', 'fiddles', 'a', 'b', 'c_d.clj'),
            path.join('u', 'p'),
            [{ source: ['src'], fiddle: ['dev', 'fiddles'] }]
          )
        ).toBe(path.join('u', 'p', 'src', 'a', 'b', 'c_d'));
      });
      it('with fiddle->source map and a .fiddle file, gets source base as sibling', function () {
        expect(
          fiddleFiles.getSourceBaseForFiddleFile(
            path.join('u', 'p', 'src', 'a', 'b', 'c_d.fiddle'),
            path.join('u', 'p'),
            [{ source: ['src'], fiddle: ['dev', 'fiddles'] }]
          )
        ).toBe(path.join('u', 'p', 'src', 'a', 'b', 'c_d'));
      });
      it('with fiddle->source map with several matching source mappings, gets fiddle file for first', function () {
        expect(
          fiddleFiles.getSourceBaseForFiddleFile(
            path.join('u', 'p', 'dev', 'fiddles', 'a', 'b', 'c_d.cljc'),
            path.join('u', 'p'),
            [
              { source: ['no-source'], fiddle: ['no-match'] },
              { source: ['first'], fiddle: ['dev', 'fiddles'] },
              { source: ['second'], fiddle: ['dev', 'fiddles'] },
            ]
          )
        ).toBe(path.join('u', 'p', 'first', 'a', 'b', 'c_d'));
      });
      it('returns sibling base for .fiddle file', function () {
        expect(
          fiddleFiles.getSourceBaseForFiddleFile(
            path.join('u', 'p', 'dev', 'fiddles', 'a', 'b', 'c_d.fiddle'),
            path.join('u', 'p'),
            [{ source: ['no-source'], fiddle: ['no-match'] }]
          )
        ).toBe(path.join('u', 'p', 'dev', 'fiddles', 'a', 'b', 'c_d'));
      });
      it('returns undefined for dedicated fiddle file match', function () {
        expect(
          fiddleFiles.getSourceBaseForFiddleFile(
            path.join('u', 'p', 'dev', 'fiddles', 'a.ext'),
            path.join('u', 'p'),
            [{ source: ['src'], fiddle: ['dev', 'fiddles', 'a.ext'] }]
          )
        ).toBeUndefined();
      });
      it('throws when project root does not match', function () {
        expect(() =>
          fiddleFiles.getSourceBaseForFiddleFile(
            path.join('u', 'p', 'dev', 'fiddles', 'a', 'b', 'c_d.cljc'),
            path.join('u', 'p-no'),
            [
              { source: ['no-source'], fiddle: ['no-match'] },
              { source: ['first'], fiddle: ['dev', 'fiddles'] },
              { source: ['second'], fiddle: ['dev', 'fiddles'] },
            ]
          )
        ).toThrow(fiddleFiles.FiddleMappingException);
      });
    });

    describe('source file', () => {
      const mockWorkspace: fiddleFiles.Workspace = {
        findFiles: (_pattern: string) => {
          return Promise.resolve([
            { fsPath: path.join('u', 'p', 'src', 'a', 'b', 'c_d.clj') },
            { fsPath: path.join('u', 'p', 'src', 'a', 'b', 'c_d.cljc') },
          ]);
        },
        asRelativePath(pathOrUri, includeWorkspaceFolder) {
          return ''; // not used
        },
      };
      it('without fiddle->source map, gets cljc source file for fiddle file', async function () {
        expect(
          await fiddleFiles.getSourceForFiddleFile(
            path.join('u', 'p', 'src', 'a', 'b', 'c_d.fiddle'),
            path.join('u', 'p'),
            null,
            mockWorkspace,
            ['cljc', 'clj']
          )
        ).toBe(path.join('u', 'p', 'src', 'a', 'b', 'c_d.cljc'));
      });
      it('with fiddle->source map, gets source clj for clj fiddle file', async function () {
        expect(
          await fiddleFiles.getSourceForFiddleFile(
            path.join('u', 'p', 'dev', 'fiddles', 'a', 'b', 'c_d.clj'),
            path.join('u', 'p'),
            [{ source: ['src'], fiddle: ['dev', 'fiddles'] }],
            mockWorkspace
          )
        ).toBe(path.join('u', 'p', 'src', 'a', 'b', 'c_d.clj'));
      });
      it('with fiddle->source map, gets sibling source clj for .fiddle file', async function () {
        expect(
          await fiddleFiles.getSourceForFiddleFile(
            path.join('u', 'p', 'src', 'a', 'b', 'c_d.fiddle'),
            path.join('u', 'p'),
            [{ source: ['src'], fiddle: ['dev', 'fiddles'] }],
            mockWorkspace,
            ['cljc', 'clj']
          )
        ).toBe(path.join('u', 'p', 'src', 'a', 'b', 'c_d.cljc'));
      });
      it('with fiddle->source map, gets source bb for bb fiddle file', async function () {
        expect(
          await fiddleFiles.getSourceForFiddleFile(
            path.join('u', 'p', 'dev', 'fiddles', 'a', 'b', 'c_d.bb'),
            path.join('u', 'p'),
            [{ source: ['src'], fiddle: ['dev', 'fiddles'] }],
            mockWorkspace
          )
        ).toBe(path.join('u', 'p', 'src', 'a', 'b', 'c_d.bb'));
      });
      it('returns undefined for dedicated matching fiddle file', async function () {
        expect(
          await fiddleFiles.getSourceForFiddleFile(
            path.join('u', 'p', 'dev', 'fiddles', 'a.ext'),
            path.join('u', 'p'),
            [{ source: ['src'], fiddle: ['dev', 'fiddles', 'a.ext'] }],
            mockWorkspace
          )
        ).toBeUndefined();
      });
    });
  });
});
