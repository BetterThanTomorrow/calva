import * as expectLib from 'expect';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as fileOutput from '../../results-output/file-output';

describe('file-output', () => {
  describe('isFilePathDestination', () => {
    it('matches relative paths starting with ./', () => {
      expectLib.expect(fileOutput.isFilePathDestination('./foo')).toBe(true);
      expectLib.expect(fileOutput.isFilePathDestination('./logs/output.txt')).toBe(true);
    });

    it('matches relative paths starting with ../', () => {
      expectLib.expect(fileOutput.isFilePathDestination('../foo')).toBe(true);
    });

    it('matches absolute Unix paths', () => {
      expectLib.expect(fileOutput.isFilePathDestination('/abs/path')).toBe(true);
      expectLib.expect(fileOutput.isFilePathDestination('/tmp/output.txt')).toBe(true);
    });

    it('matches tilde paths', () => {
      expectLib.expect(fileOutput.isFilePathDestination('~/foo')).toBe(true);
      expectLib.expect(fileOutput.isFilePathDestination('~/logs/output.txt')).toBe(true);
    });

    it('matches Windows drive letter paths', () => {
      expectLib.expect(fileOutput.isFilePathDestination('C:\\foo')).toBe(true);
      expectLib.expect(fileOutput.isFilePathDestination('D:/foo')).toBe(true);
    });

    it('does not match builtin destination names', () => {
      expectLib.expect(fileOutput.isFilePathDestination('terminal')).toBe(false);
      expectLib.expect(fileOutput.isFilePathDestination('repl-window')).toBe(false);
      expectLib.expect(fileOutput.isFilePathDestination('output-channel')).toBe(false);
      expectLib.expect(fileOutput.isFilePathDestination('output-view')).toBe(false);
    });

    it('does not match bare strings (future enum values)', () => {
      expectLib.expect(fileOutput.isFilePathDestination('some-future-name')).toBe(false);
    });

    it('does not match empty string', () => {
      expectLib.expect(fileOutput.isFilePathDestination('')).toBe(false);
    });
  });

  describe('expandTilde', () => {
    it('expands ~/path to homedir', () => {
      const result = fileOutput.expandTilde('~/logs');
      expectLib.expect(result).toBe(path.join(os.homedir(), 'logs'));
    });

    it('expands ~\\path to homedir (Windows separator)', () => {
      const result = fileOutput.expandTilde('~\\logs');
      expectLib.expect(result).toBe(path.join(os.homedir(), 'logs'));
    });

    it('leaves relative paths unchanged', () => {
      expectLib.expect(fileOutput.expandTilde('./rel')).toBe('./rel');
    });

    it('leaves ~user/foo unchanged (not supported)', () => {
      expectLib.expect(fileOutput.expandTilde('~user/foo')).toBe('~user/foo');
    });

    it('leaves absolute paths unchanged', () => {
      expectLib.expect(fileOutput.expandTilde('/abs/path')).toBe('/abs/path');
    });
  });

  describe('resolveOutputFilePath', () => {
    it('resolves relative path against workspace root', () => {
      const result = fileOutput.resolveOutputFilePath('./logs/out.txt', '/workspace');
      expectLib.expect(result).toBe(path.join('/workspace', 'logs', 'out.txt'));
    });

    it('returns absolute path as-is', () => {
      const result = fileOutput.resolveOutputFilePath('/tmp/output.txt', '/workspace');
      expectLib.expect(result).toBe('/tmp/output.txt');
    });

    it('expands tilde before resolving', () => {
      const result = fileOutput.resolveOutputFilePath('~/logs/out.txt', '/workspace');
      expectLib.expect(result).toBe(path.join(os.homedir(), 'logs', 'out.txt'));
    });

    it('joins array segments then resolves', () => {
      const result = fileOutput.resolveOutputFilePath(['.', 'logs', 'out.txt'], '/workspace');
      expectLib.expect(result).toBe(path.join('/workspace', 'logs', 'out.txt'));
    });

    it('returns undefined when relative path and no workspace root', () => {
      const result = fileOutput.resolveOutputFilePath('./logs/out.txt', undefined);
      expectLib.expect(result).toBeUndefined();
    });
  });

  describe('appendToOutputFile', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'calva-file-output-test-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('creates directory and file', async () => {
      const filePath = path.join(tmpDir, 'sub', 'dir', 'output.txt');
      await fileOutput.appendToOutputFile(filePath, 'hello');
      const content = fs.readFileSync(filePath, 'utf-8');
      expectLib.expect(content).toBe('hello');
    });

    it('appends to existing file', async () => {
      const filePath = path.join(tmpDir, 'output.txt');
      await fileOutput.appendToOutputFile(filePath, 'first');
      await fileOutput.appendToOutputFile(filePath, 'second');
      const content = fs.readFileSync(filePath, 'utf-8');
      expectLib.expect(content).toBe('firstsecond');
    });

    it('multiple appends accumulate', async () => {
      const filePath = path.join(tmpDir, 'output.txt');
      await fileOutput.appendToOutputFile(filePath, 'a\n');
      await fileOutput.appendToOutputFile(filePath, 'b\n');
      await fileOutput.appendToOutputFile(filePath, 'c\n');
      const content = fs.readFileSync(filePath, 'utf-8');
      expectLib.expect(content).toBe('a\nb\nc\n');
    });
  });

  describe('reportFileOutputError / resetFileOutputErrors', () => {
    beforeEach(() => {
      fileOutput.resetFileOutputErrors();
    });

    it('calls showError on first occurrence', () => {
      const calls: string[] = [];
      const showError = (msg: string) => calls.push(msg);
      fileOutput.reportFileOutputError('./log.txt', new Error('EACCES'), showError);
      expectLib.expect(calls).toHaveLength(1);
      expectLib.expect(calls[0]).toContain('./log.txt');
    });

    it('does not call showError on second occurrence for same destination', () => {
      const calls: string[] = [];
      const showError = (msg: string) => calls.push(msg);
      fileOutput.reportFileOutputError('./log.txt', new Error('EACCES'), showError);
      fileOutput.reportFileOutputError('./log.txt', new Error('EACCES'), showError);
      expectLib.expect(calls).toHaveLength(1);
    });

    it('calls showError for different destinations independently', () => {
      const calls: string[] = [];
      const showError = (msg: string) => calls.push(msg);
      fileOutput.reportFileOutputError('./log1.txt', new Error('EACCES'), showError);
      fileOutput.reportFileOutputError('./log2.txt', new Error('EACCES'), showError);
      expectLib.expect(calls).toHaveLength(2);
    });

    it('calls showError again after reset', () => {
      const calls: string[] = [];
      const showError = (msg: string) => calls.push(msg);
      fileOutput.reportFileOutputError('./log.txt', new Error('EACCES'), showError);
      fileOutput.resetFileOutputErrors();
      fileOutput.reportFileOutputError('./log.txt', new Error('EACCES'), showError);
      expectLib.expect(calls).toHaveLength(2);
    });

    it('always logs to console.error', () => {
      const origConsoleError = console.error;
      const consoleCalls: unknown[][] = [];
      console.error = (...args: unknown[]) => consoleCalls.push(args);
      try {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        const showError = () => {};
        fileOutput.reportFileOutputError('./log.txt', new Error('fail'), showError);
        fileOutput.reportFileOutputError('./log.txt', new Error('fail'), showError);
        expectLib.expect(consoleCalls).toHaveLength(2);
      } finally {
        console.error = origConsoleError;
      }
    });
  });
});
