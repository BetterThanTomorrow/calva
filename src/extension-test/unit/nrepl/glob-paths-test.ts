import { expect } from 'chai';
import * as path from 'path';
import { buildGlobCandidatePaths, toPosixPath } from '../../../nrepl/glob-paths';

describe('glob path candidates', () => {
  const workspaceRoot = path.join(process.cwd(), 'tmp-workspace-tests');
  const fooFolder = { name: 'foo', fsPath: path.join(workspaceRoot, 'foo') };
  const barFolder = { name: 'bar', fsPath: path.join(workspaceRoot, 'bar') };
  const filePath = path.join(fooFolder.fsPath, 'src', 'core.clj');

  it('includes absolute and basename variants', () => {
    const candidates = buildGlobCandidatePaths(filePath, []);
    expect(candidates).to.include(
      path.join(workspaceRoot, 'foo', 'src', 'core.clj').replace(/\\/g, '/')
    );
    expect(candidates).to.include('core.clj');
  });

  it('includes workspace-relative paths', () => {
    const candidates = buildGlobCandidatePaths(filePath, [fooFolder]);
    expect(candidates).to.include('src/core.clj');
  });

  it('includes workspace-folder-prefixed paths for multi-root workspaces', () => {
    const candidates = buildGlobCandidatePaths(filePath, [fooFolder, barFolder]);
    expect(candidates).to.include('foo/src/core.clj');
    expect(candidates).to.not.include('bar/src/core.clj');
  });

  it('omits workspace-relative entries when the file is outside the folders', () => {
    const externalPath = path.join(workspaceRoot, 'external', 'src', 'core.clj');
    const candidates = buildGlobCandidatePaths(externalPath, [fooFolder]);
    expect(candidates).to.include(toPosixPath(externalPath));
    expect(candidates).to.include('core.clj');
    expect(candidates).to.not.include('src/core.clj');
  });

  it('normalizes path separators to posix style', () => {
    expect(toPosixPath('C:\\foo\\bar\\src\\core.clj')).to.equal('C:/foo/bar/src/core.clj');
  });
});
