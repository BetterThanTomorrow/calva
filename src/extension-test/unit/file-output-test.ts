import { expect } from 'expect';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  isFilePathDestination,
  expandTilde,
  resolveOutputFilePath,
  appendToOutputFile,
  reportFileOutputError,
  resetFileOutputErrors,
} from '../../results-output/file-output';

describe('file-output', () => {
  describe('isFilePathDestination', () => {
    it('matches relative paths starting with ./', () => {
      expect(isFilePathDestination('./foo')).toBe(true);
      expect(isFilePathDestination('./logs/output.txt')).toBe(true);
    });

    it('matches relative paths starting with ../', () => {
      expect(isFilePathDestination('../foo')).toBe(true);
    });

    it('matches absolute Unix paths', () => {
      expect(isFilePathDestination('/abs/path')).toBe(true);
      expect(isFilePathDestination('/tmp/output.txt')).toBe(true);
    });

    it('matches tilde paths', () => {
      expect(isFilePathDestination('~/foo')).toBe(true);
      expect(isFilePathDestination('~/logs/output.txt')).toBe(true);
    });

    it('matches Windows drive letter paths', () => {
      expect(isFilePathDestination('C:\\foo')).toBe(true);
      expect(isFilePathDestination('D:/foo')).toBe(true);
    });

    it('does not match builtin destination names', () => {
      expect(isFilePathDestination('terminal')).toBe(false);
      expect(isFilePathDestination('repl-window')).toBe(false);
      expect(isFilePathDestination('output-channel')).toBe(false);
      expect(isFilePathDestination('output-view')).toBe(false);
    });

    it('does not match bare strings (future enum values)', () => {
      expect(isFilePathDestination('some-future-name')).toBe(false);
    });

    it('does not match empty string', () => {
      expect(isFilePathDestination('')).toBe(false);
    });
  });

  describe('expandTilde', () => {
    it('expands ~/path to homedir', () => {
      const result = expandTilde('~/logs');
      expect(result).toBe(path.join(os.homedir(), 'logs'));
    });

    it('expands ~\\path to homedir (Windows separator)', () => {
      const result = expandTilde('~\\logs');
      expect(result).toBe(path.join(os.homedir(), 'logs'));
    });

    it('leaves relative paths unchanged', () => {
      expect(expandTilde('./rel')).toBe('./rel');
    });

    it('leaves ~user/foo unchanged (not supported)', () => {
      expect(expandTilde('~user/foo')).toBe('~user/foo');
    });

    it('leaves absolute paths unchanged', () => {
      expect(expandTilde('/abs/path')).toBe('/abs/path');
    });
  });

  describe('resolveOutputFilePath', () => {
    it('resolves relative path against workspace root', () => {
      const result = resolveOutputFilePath('./logs/out.txt', '/workspace');
      expect(result).toBe(path.join('/workspace', 'logs', 'out.txt'));
    });

    it('returns absolute path as-is', () => {
      const result = resolveOutputFilePath('/tmp/output.txt', '/workspace');
      expect(result).toBe('/tmp/output.txt');
    });

    it('expands tilde before resolving', () => {
      const result = resolveOutputFilePath('~/logs/out.txt', '/workspace');
      expect(result).toBe(path.join(os.homedir(), 'logs', 'out.txt'));
    });

    it('joins array segments then resolves', () => {
      const result = resolveOutputFilePath(['.', 'logs', 'out.txt'], '/workspace');
      expect(result).toBe(path.join('/workspace', 'logs', 'out.txt'));
    });

    it('returns undefined when relative path and no workspace root', () => {
      const result = resolveOutputFilePath('./logs/out.txt', undefined);
      expect(result).toBeUndefined();
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
      await appendToOutputFile(filePath, 'hello');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toBe('hello');
    });

    it('appends to existing file', async () => {
      const filePath = path.join(tmpDir, 'output.txt');
      await appendToOutputFile(filePath, 'first');
      await appendToOutputFile(filePath, 'second');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toBe('firstsecond');
    });

    it('multiple appends accumulate', async () => {
      const filePath = path.join(tmpDir, 'output.txt');
      await appendToOutputFile(filePath, 'a\n');
      await appendToOutputFile(filePath, 'b\n');
      await appendToOutputFile(filePath, 'c\n');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toBe('a\nb\nc\n');
    });
  });

  describe('reportFileOutputError / resetFileOutputErrors', () => {
    beforeEach(() => {
      resetFileOutputErrors();
    });

    it('calls showError on first occurrence', () => {
      const calls: string[] = [];
      const showError = (msg: string) => calls.push(msg);
      reportFileOutputError('./log.txt', new Error('EACCES'), showError);
      expect(calls).toHaveLength(1);
      expect(calls[0]).toContain('./log.txt');
    });

    it('does not call showError on second occurrence for same destination', () => {
      const calls: string[] = [];
      const showError = (msg: string) => calls.push(msg);
      reportFileOutputError('./log.txt', new Error('EACCES'), showError);
      reportFileOutputError('./log.txt', new Error('EACCES'), showError);
      expect(calls).toHaveLength(1);
    });

    it('calls showError for different destinations independently', () => {
      const calls: string[] = [];
      const showError = (msg: string) => calls.push(msg);
      reportFileOutputError('./log1.txt', new Error('EACCES'), showError);
      reportFileOutputError('./log2.txt', new Error('EACCES'), showError);
      expect(calls).toHaveLength(2);
    });

    it('calls showError again after reset', () => {
      const calls: string[] = [];
      const showError = (msg: string) => calls.push(msg);
      reportFileOutputError('./log.txt', new Error('EACCES'), showError);
      resetFileOutputErrors();
      reportFileOutputError('./log.txt', new Error('EACCES'), showError);
      expect(calls).toHaveLength(2);
    });

    it('always logs to console.error', () => {
      const origConsoleError = console.error;
      const consoleCalls: unknown[][] = [];
      console.error = (...args: unknown[]) => consoleCalls.push(args);
      try {
        const showError = () => {};
        reportFileOutputError('./log.txt', new Error('fail'), showError);
        reportFileOutputError('./log.txt', new Error('fail'), showError);
        expect(consoleCalls).toHaveLength(2);
      } finally {
        console.error = origConsoleError;
      }
    });
  });
});
