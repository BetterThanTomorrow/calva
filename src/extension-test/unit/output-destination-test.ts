import { expect } from 'expect';
import { normalizeDestinations, OutputDestination } from '../../results-output/output-destinations';

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
  });
});
