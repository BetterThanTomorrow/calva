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

  describe('restoreFromBackup', () => {
    it('returns false when the backup directory exists but is empty', async () => {
      fs.rmSync(binaryPath);
      fs.mkdirSync(path.join(tmpDir, 'backup'), { recursive: true });

      const restored = await downloaderUtils.restoreFromBackup(binaryPath);

      expectLib.expect(restored).toBe(false);
      expectLib.expect(fs.existsSync(binaryPath)).toBe(false);
    });

    it('restores backup binary to original path when main binary is missing', async () => {
      const backupDir = path.join(tmpDir, 'backup');
      fs.mkdirSync(backupDir, { recursive: true });
      const backupPath = path.join(backupDir, 'clojure-lsp');
      fs.writeFileSync(backupPath, 'backup-version');
      fs.rmSync(binaryPath);

      const restored = await downloaderUtils.restoreFromBackup(binaryPath);

      expectLib.expect(restored).toBe(true);
      expectLib.expect(fs.existsSync(binaryPath)).toBe(true);
      expectLib.expect(fs.readFileSync(binaryPath, 'utf8')).toBe('backup-version');
      expectLib.expect(fs.existsSync(backupPath)).toBe(false);
    });
  });

  describe('findHighestLocalClojureLsp', () => {
    let extensionsRoot: string;
    let currentExtensionPath: string;

    beforeEach(() => {
      extensionsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'calva-extensions-root-'));
      currentExtensionPath = path.join(
        extensionsRoot,
        'betterthantomorrow.calva-2.0.584-universal'
      );
      fs.mkdirSync(currentExtensionPath, { recursive: true });
    });

    afterEach(() => {
      fs.rmSync(extensionsRoot, { recursive: true, force: true });
    });

    function seedSibling(folderName: string, opts: { binary?: string; version?: string }) {
      const folder = path.join(extensionsRoot, folderName);
      fs.mkdirSync(folder, { recursive: true });
      if (opts.binary !== undefined) {
        fs.writeFileSync(path.join(folder, 'clojure-lsp'), opts.binary);
      }
      if (opts.version !== undefined) {
        fs.writeFileSync(path.join(folder, 'clojure-lsp-version'), opts.version);
      }
      return folder;
    }

    it('returns null when there are no sibling Calva folders', async () => {
      const candidate = await downloaderUtils.findHighestLocalClojureLsp(
        currentExtensionPath,
        'clojure-lsp',
        'clojure-lsp-version'
      );

      expectLib.expect(candidate).toBeNull();
    });

    it('returns null when sibling folders have no clojure-lsp binary', async () => {
      seedSibling('betterthantomorrow.calva-2.0.582-universal', {
        version: '2026.05.05-12.58.58-nightly',
      });

      const candidate = await downloaderUtils.findHighestLocalClojureLsp(
        currentExtensionPath,
        'clojure-lsp',
        'clojure-lsp-version'
      );

      expectLib.expect(candidate).toBeNull();
    });

    it('skips the current extension folder even if it has a binary', async () => {
      fs.writeFileSync(path.join(currentExtensionPath, 'clojure-lsp'), 'self');
      fs.writeFileSync(
        path.join(currentExtensionPath, 'clojure-lsp-version'),
        '2026.05.05-12.58.58-nightly'
      );

      const candidate = await downloaderUtils.findHighestLocalClojureLsp(
        currentExtensionPath,
        'clojure-lsp',
        'clojure-lsp-version'
      );

      expectLib.expect(candidate).toBeNull();
    });

    it('ignores unrelated extensions that share a prefix character', async () => {
      seedSibling('someother.publisher-1.0.0', {
        binary: 'unrelated',
        version: '9999.12.31-23.59.59',
      });

      const candidate = await downloaderUtils.findHighestLocalClojureLsp(
        currentExtensionPath,
        'clojure-lsp',
        'clojure-lsp-version'
      );

      expectLib.expect(candidate).toBeNull();
    });

    it('returns the highest-version sibling binary across the real reporter scenario', async () => {
      fs.mkdirSync(path.join(currentExtensionPath, 'backup'), { recursive: true });
      seedSibling('betterthantomorrow.calva-2.0.575-universal', {
        binary: 'binary-2.0.575',
        version: '2026.04.28-13.12.15-nightly',
      });
      seedSibling('betterthantomorrow.calva-2.0.578-universal', {
        binary: 'binary-2.0.578',
        version: '2026.04.28-13.12.15-nightly',
      });
      seedSibling('betterthantomorrow.calva-2.0.579-universal', {
        binary: 'binary-2.0.579',
        version: '2026.04.28-13.12.15-nightly',
      });
      seedSibling('betterthantomorrow.calva-2.0.580-universal', {});
      const expectedFolder = seedSibling('betterthantomorrow.calva-2.0.582-universal', {
        binary: 'binary-2.0.582',
        version: '2026.05.05-12.58.58-nightly',
      });

      const candidate = await downloaderUtils.findHighestLocalClojureLsp(
        currentExtensionPath,
        'clojure-lsp',
        'clojure-lsp-version'
      );

      expectLib.expect(candidate).not.toBeNull();
      expectLib.expect(candidate?.binaryPath).toBe(path.join(expectedFolder, 'clojure-lsp'));
      expectLib.expect(candidate?.version).toBe('2026.05.05-12.58.58-nightly');
    });

    it('still returns a candidate when the version file is missing, deprioritizing it', async () => {
      const versionedFolder = seedSibling('betterthantomorrow.calva-2.0.578-universal', {
        binary: 'versioned-binary',
        version: '2026.04.28-13.12.15-nightly',
      });
      seedSibling('betterthantomorrow.calva-2.0.580-universal', {
        binary: 'no-version-binary',
      });

      const candidate = await downloaderUtils.findHighestLocalClojureLsp(
        currentExtensionPath,
        'clojure-lsp',
        'clojure-lsp-version'
      );

      expectLib.expect(candidate).not.toBeNull();
      expectLib.expect(candidate?.binaryPath).toBe(path.join(versionedFolder, 'clojure-lsp'));
    });
  });

  describe('adoptLocalClojureLsp', () => {
    it('copies the sibling binary into the upgraded extension folder and writes the version file', async () => {
      const extensionsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'calva-adopt-root-'));
      const oldExtensionPath = path.join(
        extensionsRoot,
        'betterthantomorrow.calva-2.0.582-universal'
      );
      const newExtensionPath = path.join(
        extensionsRoot,
        'betterthantomorrow.calva-2.0.584-universal'
      );
      fs.mkdirSync(oldExtensionPath, { recursive: true });
      fs.mkdirSync(newExtensionPath, { recursive: true });
      fs.mkdirSync(path.join(newExtensionPath, 'backup'), { recursive: true });
      const sourceBinary = path.join(oldExtensionPath, 'clojure-lsp');
      fs.writeFileSync(sourceBinary, 'binary-2.0.582');
      const targetBinary = path.join(newExtensionPath, 'clojure-lsp');
      const targetVersionFile = path.join(newExtensionPath, 'clojure-lsp-version');

      try {
        await downloaderUtils.adoptLocalClojureLsp(
          { binaryPath: sourceBinary, version: '2026.05.05-12.58.58-nightly' },
          targetBinary,
          targetVersionFile
        );

        expectLib.expect(fs.readFileSync(targetBinary, 'utf8')).toBe('binary-2.0.582');
        expectLib
          .expect(fs.readFileSync(targetVersionFile, 'utf8'))
          .toBe('2026.05.05-12.58.58-nightly');
        expectLib.expect(fs.existsSync(sourceBinary)).toBe(true);
      } finally {
        fs.rmSync(extensionsRoot, { recursive: true, force: true });
      }
    });

    it('skips writing the version file when the candidate has no version', async () => {
      const sourceFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'calva-adopt-source-'));
      const sourceBinary = path.join(sourceFolder, 'clojure-lsp');
      fs.writeFileSync(sourceBinary, 'source-binary');
      fs.rmSync(binaryPath);
      const targetVersionFile = path.join(tmpDir, 'clojure-lsp-version');

      try {
        await downloaderUtils.adoptLocalClojureLsp(
          { binaryPath: sourceBinary, version: '' },
          binaryPath,
          targetVersionFile
        );

        expectLib.expect(fs.readFileSync(binaryPath, 'utf8')).toBe('source-binary');
        expectLib.expect(fs.existsSync(targetVersionFile)).toBe(false);
      } finally {
        fs.rmSync(sourceFolder, { recursive: true, force: true });
      }
    });
  });
});
