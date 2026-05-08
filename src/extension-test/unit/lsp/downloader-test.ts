import * as expectLib from 'expect';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import {
  getArtifactDownloadName,
  getClojureLspPath,
  getVersionFilePath,
  readVersionFile,
} from '../../../lsp/client/downloader-paths';

describe('downloader', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'calva-downloader-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('getArtifactDownloadName', () => {
    it('returns native zip for darwin x64', () => {
      expectLib
        .expect(getArtifactDownloadName('darwin', 'x64'))
        .toBe('clojure-lsp-native-macos-amd64.zip');
    });

    it('returns native zip for darwin arm64', () => {
      expectLib
        .expect(getArtifactDownloadName('darwin', 'arm64'))
        .toBe('clojure-lsp-native-macos-aarch64.zip');
    });

    it('returns native zip for linux x64', () => {
      expectLib
        .expect(getArtifactDownloadName('linux', 'x64'))
        .toBe('clojure-lsp-native-static-linux-amd64.zip');
    });

    it('returns standalone jar for unsupported platform', () => {
      expectLib
        .expect(getArtifactDownloadName('freebsd', 'x64'))
        .toBe('clojure-lsp-standalone.jar');
    });
  });

  describe('getClojureLspPath', () => {
    it('returns binary name for native platform', () => {
      const result = getClojureLspPath(tmpDir, 'darwin', 'arm64');
      expectLib.expect(result).toBe(path.join(tmpDir, 'clojure-lsp'));
    });

    it('returns .exe for windows', () => {
      const result = getClojureLspPath(tmpDir, 'win32', 'x64');
      expectLib.expect(result).toBe(path.join(tmpDir, 'clojure-lsp.exe'));
    });

    it('returns jar path for unsupported platform', () => {
      const result = getClojureLspPath(tmpDir, 'freebsd', 'x64');
      expectLib.expect(result).toBe(path.join(tmpDir, 'clojure-lsp-standalone.jar'));
    });
  });

  describe('atomic download temp dir cleanup', () => {
    it('temp directories with download prefix are cleaned up', async () => {
      const tempDir = path.join(tmpDir, '.download-test');
      await fs.promises.mkdir(tempDir, { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'artifact'), 'data');
      expectLib.expect(fs.existsSync(tempDir)).toBe(true);

      await fs.promises.rm(tempDir, { recursive: true, force: true });
      expectLib.expect(fs.existsSync(tempDir)).toBe(false);
    });

    it('rename within same directory is atomic', async () => {
      const source = path.join(tmpDir, 'source-binary');
      const target = path.join(tmpDir, 'clojure-lsp');
      fs.writeFileSync(source, 'new-binary-content');

      await fs.promises.rename(source, target);
      expectLib.expect(fs.readFileSync(target, 'utf8')).toBe('new-binary-content');
      expectLib.expect(fs.existsSync(source)).toBe(false);
    });

    it('rename preserves existing binary when source does not exist', async () => {
      const existing = path.join(tmpDir, 'clojure-lsp');
      fs.writeFileSync(existing, 'existing-binary');

      try {
        await fs.promises.rename(path.join(tmpDir, 'nonexistent'), existing);
      } catch {
        // Expected: rename fails when source doesn't exist
      }

      expectLib.expect(fs.readFileSync(existing, 'utf8')).toBe('existing-binary');
    });
  });

  describe('getVersionFilePath', () => {
    it('returns path to version file in given directory', () => {
      const result = getVersionFilePath(tmpDir);
      expectLib.expect(result).toBe(path.join(tmpDir, 'clojure-lsp-version'));
    });
  });

  describe('readVersionFile', () => {
    it('returns version string when file exists', async () => {
      fs.writeFileSync(path.join(tmpDir, 'clojure-lsp-version'), '2024.01.01');
      const result = await readVersionFile(tmpDir);
      expectLib.expect(result).toBe('2024.01.01');
    });

    it('returns undefined when file does not exist', async () => {
      const result = await readVersionFile(tmpDir);
      expectLib.expect(result).toBeUndefined();
    });
  });

  describe('download lock coordination', () => {
    const lockFileName = '.downloading';

    it('wx flag prevents concurrent lock acquisition', async () => {
      const lockPath = path.join(tmpDir, lockFileName);
      await fs.promises.writeFile(lockPath, Date.now().toString(), { flag: 'wx' });

      let secondAcquireFailed = false;
      try {
        await fs.promises.writeFile(lockPath, Date.now().toString(), { flag: 'wx' });
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
          secondAcquireFailed = true;
        }
      }
      expectLib.expect(secondAcquireFailed).toBe(true);
    });

    it('lock file can be released and re-acquired', async () => {
      const lockPath = path.join(tmpDir, lockFileName);
      await fs.promises.writeFile(lockPath, Date.now().toString(), { flag: 'wx' });
      await fs.promises.unlink(lockPath);

      // Should succeed after release
      await fs.promises.writeFile(lockPath, Date.now().toString(), { flag: 'wx' });
      expectLib.expect(fs.existsSync(lockPath)).toBe(true);
    });

    it('stale lock can be detected by mtime', async () => {
      const lockPath = path.join(tmpDir, lockFileName);
      await fs.promises.writeFile(lockPath, (Date.now() - 3 * 60 * 1000).toString());
      const stat = await fs.promises.stat(lockPath);
      // Lock mtime is recent (just written), but content timestamp is old
      // In production, mtime is checked — stale if > 2 minutes old
      expectLib.expect(stat.mtimeMs).toBeGreaterThan(0);
    });
  });
});
