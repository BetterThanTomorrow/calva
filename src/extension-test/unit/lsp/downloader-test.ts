import * as expectLib from 'expect';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as downloaderUtils from '../../../lsp/client/downloader-utils';

describe('downloader', () => {
  let tmpDir: string;
  let binaryPath: string;
  const binaryContent = 'existing-clojure-lsp-binary';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'calva-downloader-test-'));
    binaryPath = path.join(tmpDir, 'clojure-lsp');
    fs.writeFileSync(binaryPath, binaryContent);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('replaces binary with new version on successful download', async () => {
    const result = await downloaderUtils.downloadWithBackupRecovery(binaryPath, () => {
      fs.writeFileSync(binaryPath, 'new-version');
      return Promise.resolve();
    });

    expectLib.expect(result.restored).toBe(false);
    expectLib.expect(fs.readFileSync(binaryPath, 'utf8')).toBe('new-version');
    const backupPath = path.join(tmpDir, 'backup', 'clojure-lsp');
    expectLib.expect(fs.existsSync(backupPath)).toBe(false);
  });

  it('restores binary to original path after failed download so offline startup works', async () => {
    await downloaderUtils.downloadWithBackupRecovery(binaryPath, () => {
      return Promise.reject(new Error('network unavailable'));
    });

    expectLib.expect(fs.existsSync(binaryPath)).toBe(true);
    expectLib.expect(fs.readFileSync(binaryPath, 'utf8')).toBe(binaryContent);
  });

  it('restores original binary even when download corrupts the file before failing', async () => {
    await downloaderUtils.downloadWithBackupRecovery(binaryPath, () => {
      fs.writeFileSync(binaryPath, 'corrupted-partial-download');
      return Promise.reject(new Error('connection reset'));
    });

    expectLib.expect(fs.existsSync(binaryPath)).toBe(true);
    expectLib.expect(fs.readFileSync(binaryPath, 'utf8')).toBe(binaryContent);
  });
});
