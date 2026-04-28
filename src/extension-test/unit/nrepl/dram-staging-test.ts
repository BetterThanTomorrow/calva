import * as expectLib from 'expect';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import JSZip = require('jszip');
import * as dramStaging from '../../../../src/nrepl/dram-staging';

describe('dram staging', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'calva-dram-staging-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function writeZip(zipPath: string, entries: Record<string, string>) {
    const zip = new JSZip();

    Object.entries(entries).forEach(([entryPath, contents]) => {
      zip.file(entryPath, contents);
    });

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    await fs.promises.writeFile(zipPath, new Uint8Array(buffer));
  }

  it('strips the single wrapper directory from github source archives', async () => {
    const zipPath = path.join(tmpDir, 'starter.zip');
    const destinationPath = path.join(tmpDir, 'staged');
    await writeZip(zipPath, {
      'try-clojure-main/src/try_clojure/core.clj': '(ns try-clojure.core)',
      'try-clojure-main/calva-README.md': '# Try Clojure',
    });

    await dramStaging.stageGithubArchive(zipPath, destinationPath);

    expectLib
      .expect(fs.existsSync(path.join(destinationPath, 'src/try_clojure/core.clj')))
      .toBe(true);
    expectLib.expect(fs.existsSync(path.join(destinationPath, 'calva-README.md'))).toBe(true);
    expectLib.expect(fs.existsSync(path.join(destinationPath, 'try-clojure-main'))).toBe(false);
  });

  it('normalizes safe archive paths and rejects traversal paths', () => {
    expectLib
      .expect(
        dramStaging.buildGithubArchiveStagingPlan([
          'try-clojure-main/src/../README.md',
          'try-clojure-main/src/try_clojure/core.clj',
        ])
      )
      .toEqual([
        {
          archivePath: 'try-clojure-main/src/../README.md',
          relativePath: 'README.md',
        },
        {
          archivePath: 'try-clojure-main/src/try_clojure/core.clj',
          relativePath: 'src/try_clojure/core.clj',
        },
      ]);

    expectLib
      .expect(() => dramStaging.buildGithubArchiveStagingPlan(['try-clojure-main/../../evil.txt']))
      .toThrow('Unsafe archive entry path: try-clojure-main/../../evil.txt');
  });

  it('lets later overlay files replace extracted archive files in the staging area', async () => {
    const zipPath = path.join(tmpDir, 'starter.zip');
    const destinationPath = path.join(tmpDir, 'staged');
    const overlaySourcePath = path.join(tmpDir, 'overlay', 'calva-README.md');

    await writeZip(zipPath, {
      'try-clojure-main/calva-README.md': '# Archive README',
    });
    await fs.promises.mkdir(path.dirname(overlaySourcePath), { recursive: true });
    await fs.promises.writeFile(overlaySourcePath, '# Overlay README');

    await dramStaging.stageGithubArchive(zipPath, destinationPath);
    await dramStaging.stageOverlayFile(overlaySourcePath, destinationPath, 'calva-README.md');

    expectLib
      .expect(fs.readFileSync(path.join(destinationPath, 'calva-README.md'), 'utf8'))
      .toBe('# Overlay README');
  });
});
