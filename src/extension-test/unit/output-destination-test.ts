import { expect } from 'expect';
import { normalizeDestinations, OutputDestination } from '../../results-output/output-destinations';
import * as path from 'path';

describe('output destinations', () => {
  describe('normalizeDestinations', () => {
    it('wraps a single string in an array', () => {
      expect(normalizeDestinations('terminal')).toStrictEqual(['terminal']);
    });

    it('wraps each destination type correctly', () => {
      const destinations: OutputDestination[] = [
        'repl-window',
        'output-channel',
        'terminal',
        'output-view',
      ];
      for (const dest of destinations) {
        expect(normalizeDestinations(dest)).toStrictEqual([dest]);
      }
    });

    it('passes through an array unchanged', () => {
      expect(normalizeDestinations(['terminal', 'repl-window'])).toStrictEqual([
        'terminal',
        'repl-window',
      ]);
    });

    it('deduplicates an array', () => {
      expect(normalizeDestinations(['terminal', 'terminal', 'repl-window'])).toStrictEqual([
        'terminal',
        'repl-window',
      ]);
    });

    it('returns an empty array for an empty array (silent)', () => {
      expect(normalizeDestinations([])).toStrictEqual([]);
    });

    it('wraps a file path string in an array', () => {
      expect(normalizeDestinations('./log.txt')).toStrictEqual(['./log.txt']);
    });

    it('accepts file path strings alongside builtins', () => {
      expect(normalizeDestinations(['terminal', './log.txt'])).toStrictEqual([
        'terminal',
        './log.txt',
      ]);
    });

    it('joins nested array path segments', () => {
      const result = normalizeDestinations(['terminal', ['.', 'logs', 'out.txt']]);
      expect(result).toStrictEqual(['terminal', path.join('.', 'logs', 'out.txt')]);
    });

    it('treats flat array of strings as separate destinations, not path segments', () => {
      expect(normalizeDestinations(['.', 'logs', 'out.txt'])).toStrictEqual([
        '.',
        'logs',
        'out.txt',
      ]);
    });

    it('deduplicates file path destinations', () => {
      expect(normalizeDestinations(['./log.txt', './log.txt'])).toStrictEqual(['./log.txt']);
    });
  });
});
