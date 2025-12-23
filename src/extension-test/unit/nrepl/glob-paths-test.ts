import * as chai from 'chai';
import * as path from 'path';
import * as globPaths from '../../../nrepl/glob-paths';

describe('glob path candidates', () => {
  const workspaceRoot = path.join(process.cwd(), 'tmp-workspace-tests');
  const fooFolder = { name: 'foo', fsPath: path.join(workspaceRoot, 'foo') };
  const barFolder = { name: 'bar', fsPath: path.join(workspaceRoot, 'bar') };
  const filePath = path.join(fooFolder.fsPath, 'src', 'core.clj');

  it('includes absolute and basename variants', () => {
    const candidates = globPaths.buildGlobCandidatePaths(filePath, []);
    chai
      .expect(candidates)
      .to.include(path.join(workspaceRoot, 'foo', 'src', 'core.clj').replace(/\\/g, '/'));
    chai.expect(candidates).to.include('core.clj');
  });

  it('includes workspace-relative paths', () => {
    const candidates = globPaths.buildGlobCandidatePaths(filePath, [fooFolder]);
    chai.expect(candidates).to.include('src/core.clj');
  });

  it('includes workspace-folder-prefixed paths for multi-root workspaces', () => {
    const candidates = globPaths.buildGlobCandidatePaths(filePath, [fooFolder, barFolder]);
    chai.expect(candidates).to.include('foo/src/core.clj');
    chai.expect(candidates).to.not.include('bar/src/core.clj');
  });

  it('omits workspace-relative entries when the file is outside the folders', () => {
    const externalPath = path.join(workspaceRoot, 'external', 'src', 'core.clj');
    const candidates = globPaths.buildGlobCandidatePaths(externalPath, [fooFolder]);
    chai.expect(candidates).to.include(globPaths.toPosixPath(externalPath));
    chai.expect(candidates).to.include('core.clj');
    chai.expect(candidates).to.not.include('src/core.clj');
  });

  it('normalizes path separators to posix style', () => {
    chai
      .expect(globPaths.toPosixPath('C:\\foo\\bar\\src\\core.clj'))
      .to.equal('C:/foo/bar/src/core.clj');
  });
});
