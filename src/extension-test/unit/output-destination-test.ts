import * as expectLib from 'expect';
import * as outputDestinations from '../../results-output/output-destinations';
import * as path from 'path';

describe('output destinations', () => {
  describe('normalizeDestinations', () => {
    it('wraps a single string in an array', () => {
      expectLib
        .expect(outputDestinations.normalizeDestinations('terminal'))
        .toStrictEqual(['terminal']);
    });

    it('wraps each destination type correctly', () => {
      const destinations: outputDestinations.OutputDestination[] = [
        'repl-window',
        'output-channel',
        'terminal',
        'output-view',
        'output-sidebar',
      ];
      for (const dest of destinations) {
        expectLib.expect(outputDestinations.normalizeDestinations(dest)).toStrictEqual([dest]);
      }
    });

    it('identifies webview destinations', () => {
      expectLib.expect(outputDestinations.isWebviewOutputDestination('output-view')).toBe(true);
      expectLib.expect(outputDestinations.isWebviewOutputDestination('output-sidebar')).toBe(true);
      for (const destination of ['terminal', 'repl-window', 'output-channel', './log.txt']) {
        expectLib.expect(outputDestinations.isWebviewOutputDestination(destination)).toBe(false);
      }
    });

    it('passes through an array unchanged', () => {
      expectLib
        .expect(outputDestinations.normalizeDestinations(['terminal', 'repl-window']))
        .toStrictEqual(['terminal', 'repl-window']);
    });

    it('deduplicates an array', () => {
      expectLib
        .expect(outputDestinations.normalizeDestinations(['terminal', 'terminal', 'repl-window']))
        .toStrictEqual(['terminal', 'repl-window']);
    });

    it('returns an empty array for an empty array (silent)', () => {
      expectLib.expect(outputDestinations.normalizeDestinations([])).toStrictEqual([]);
    });

    it('wraps a file path string in an array', () => {
      expectLib
        .expect(outputDestinations.normalizeDestinations('./log.txt'))
        .toStrictEqual(['./log.txt']);
    });

    it('accepts file path strings alongside builtins', () => {
      expectLib
        .expect(outputDestinations.normalizeDestinations(['terminal', './log.txt']))
        .toStrictEqual(['terminal', './log.txt']);
    });

    it('joins nested array path segments', () => {
      const result = outputDestinations.normalizeDestinations([
        'terminal',
        ['.', 'logs', 'out.txt'],
      ]);
      expectLib.expect(result).toStrictEqual(['terminal', path.join('.', 'logs', 'out.txt')]);
    });

    it('treats flat array of strings as separate destinations, not path segments', () => {
      expectLib
        .expect(outputDestinations.normalizeDestinations(['.', 'logs', 'out.txt']))
        .toStrictEqual(['.', 'logs', 'out.txt']);
    });

    it('deduplicates file path destinations', () => {
      expectLib
        .expect(outputDestinations.normalizeDestinations(['./log.txt', './log.txt']))
        .toStrictEqual(['./log.txt']);
    });
  });
});
