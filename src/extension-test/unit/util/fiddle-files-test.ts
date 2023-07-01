import * as expect from 'expect';
import * as fs from 'fs';
import * as fiddleFiles from '../../../util/fiddle-files';

describe('fiddle files', () => {
  it('without source->fiddle map, gets fiddle file for cljc file', function () {
    expect(fiddleFiles.getFiddleForFilePath('/u/p/src/a/b/c-d.cljc', '/u/p', null)).toBe(
      '/u/p/src/a/b/c-d.fiddle'
    );
  });
  it('with source->fiddle map, gets fiddle file for cljc file', function () {
    expect(
      fiddleFiles.getFiddleForFilePath('/u/p/src/a/b/c-d.cljc', '/u/p', [
        { source: ['src'], fiddle: ['dev'] },
      ])
    ).toBe('/u/p/dev/a/b/c-d.cljc');
  });
});
