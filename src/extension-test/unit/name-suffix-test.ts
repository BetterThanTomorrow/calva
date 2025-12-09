import * as expect from 'expect';
import * as nameSuffix from '../../nrepl/name-suffix';

describe('name-suffix', () => {
  afterEach(() => {
    nameSuffix.resetPool();
  });

  describe('acquireNextAvailableSuffix', () => {
    it('returns an available suffix', () => {
      const suffix = nameSuffix.acquireNextAvailableSuffix();

      expect(suffix).toBeDefined();
      expect(typeof suffix).toBe('string');
    });

    it('returns different suffixes on subsequent calls', () => {
      const suffix1 = nameSuffix.acquireNextAvailableSuffix();
      const suffix2 = nameSuffix.acquireNextAvailableSuffix();

      expect(suffix1).not.toBe(suffix2);
    });

    it('marks acquired suffix as used', () => {
      const suffix = nameSuffix.acquireNextAvailableSuffix();

      expect(nameSuffix.getUsedSuffixes()).toContain(suffix);
      expect(nameSuffix.getAvailableSuffixes()).not.toContain(suffix);
    });
  });

  describe('releaseSuffix', () => {
    it('makes a suffix available again', () => {
      const suffix = nameSuffix.acquireNextAvailableSuffix();
      expect(nameSuffix.getUsedSuffixes()).toContain(suffix);

      nameSuffix.releaseSuffix(suffix);

      expect(nameSuffix.getUsedSuffixes()).not.toContain(suffix);
      expect(nameSuffix.getAvailableSuffixes()).toContain(suffix);
    });

    it('is idempotent for unused suffixes', () => {
      nameSuffix.releaseSuffix('apple');
      nameSuffix.releaseSuffix('apple');

      expect(nameSuffix.getUsedSuffixes()).not.toContain('apple');
    });
  });

  describe('reserveSuffix', () => {
    it('reserves a specific suffix, marking it as used', () => {
      const result = nameSuffix.reserveSuffix('apple');

      expect(result).toBe(true);
      expect(nameSuffix.getUsedSuffixes()).toContain('apple');
      expect(nameSuffix.getAvailableSuffixes()).not.toContain('apple');
    });

    it('returns false if the suffix is already in use', () => {
      nameSuffix.reserveSuffix('apple');
      const result = nameSuffix.reserveSuffix('apple');

      expect(result).toBe(false);
    });

    it('prevents acquireSuffix from returning the reserved suffix', () => {
      nameSuffix.reserveSuffix('apple');

      // Acquire all available suffixes
      const acquired: string[] = [];
      while (!nameSuffix.isPoolExhausted()) {
        const suffix = nameSuffix.acquireNextAvailableSuffix();
        if (suffix) {
          acquired.push(suffix);
        }
      }

      expect(acquired).not.toContain('apple');
    });

    it('allows re-reserving a suffix after it has been released', () => {
      nameSuffix.reserveSuffix('apple');
      nameSuffix.releaseSuffix('apple');
      const result = nameSuffix.reserveSuffix('apple');

      expect(result).toBe(true);
      expect(nameSuffix.getUsedSuffixes()).toContain('apple');
    });
  });

  describe('isPoolExhausted', () => {
    it('returns false when suffixes are available', () => {
      expect(nameSuffix.isPoolExhausted()).toBe(false);
    });

    it('returns true when all suffixes are used', () => {
      const available = nameSuffix.getAvailableSuffixes();
      for (const _ of available) {
        nameSuffix.acquireNextAvailableSuffix();
      }

      expect(nameSuffix.isPoolExhausted()).toBe(true);
    });

    it('returns false after releasing a suffix from exhausted pool', () => {
      const suffixes: string[] = [];
      while (!nameSuffix.isPoolExhausted()) {
        const suffix = nameSuffix.acquireNextAvailableSuffix();
        if (suffix) {
          suffixes.push(suffix);
        }
      }
      expect(nameSuffix.isPoolExhausted()).toBe(true);

      nameSuffix.releaseSuffix(suffixes[0]);

      expect(nameSuffix.isPoolExhausted()).toBe(false);
    });
  });

  describe('extractSuffix', () => {
    it('extracts suffix from suffixed name', () => {
      expect(nameSuffix.extractSuffix('clj:apple')).toBe('apple');
      expect(nameSuffix.extractSuffix('cljs:banana')).toBe('banana');
      expect(nameSuffix.extractSuffix('my-session:cherry')).toBe('cherry');
    });

    it('returns undefined for names without suffix', () => {
      expect(nameSuffix.extractSuffix('clj')).toBeUndefined();
      expect(nameSuffix.extractSuffix('cljs')).toBeUndefined();
      expect(nameSuffix.extractSuffix('my-session')).toBeUndefined();
    });

    it('returns undefined for names with non-pool suffix', () => {
      expect(nameSuffix.extractSuffix('clj:pineapple')).toBeUndefined();
      expect(nameSuffix.extractSuffix('clj:apples')).toBeUndefined();
    });

    it('only matches suffix, not prefix or middle', () => {
      expect(nameSuffix.extractSuffix('apple:clj')).toBeUndefined();
      expect(nameSuffix.extractSuffix('apple')).toBeUndefined();
    });
  });

  describe('applySuffix', () => {
    it('applies suffix to base name', () => {
      expect(nameSuffix.applySuffix('clj', 'apple')).toBe('clj:apple');
      expect(nameSuffix.applySuffix('cljs', 'banana')).toBe('cljs:banana');
      expect(nameSuffix.applySuffix('my-session', 'cherry')).toBe('my-session:cherry');
    });
  });

  describe('stripSuffix', () => {
    it('strips suffix from suffixed name', () => {
      expect(nameSuffix.stripSuffix('clj:apple')).toBe('clj');
      expect(nameSuffix.stripSuffix('cljs:banana')).toBe('cljs');
      expect(nameSuffix.stripSuffix('my-session:cherry')).toBe('my-session');
    });

    it('returns name unchanged when no suffix', () => {
      expect(nameSuffix.stripSuffix('clj')).toBe('clj');
      expect(nameSuffix.stripSuffix('cljs')).toBe('cljs');
      expect(nameSuffix.stripSuffix('my-session')).toBe('my-session');
    });

    it('returns name unchanged for non-pool suffixes', () => {
      expect(nameSuffix.stripSuffix('clj:pineapple')).toBe('clj:pineapple');
    });
  });

  describe('resetPool', () => {
    it('releases all used suffixes', () => {
      nameSuffix.acquireNextAvailableSuffix();
      nameSuffix.acquireNextAvailableSuffix();
      nameSuffix.acquireNextAvailableSuffix();
      expect(nameSuffix.getUsedSuffixes().length).toBe(3);

      nameSuffix.resetPool();

      expect(nameSuffix.getUsedSuffixes()).toEqual([]);
    });
  });

  describe('getAvailableSuffixes', () => {
    it('returns all suffixes when none are used', () => {
      const available = nameSuffix.getAvailableSuffixes();

      expect(available.length).toBeGreaterThan(0);
      expect(available).toContain('apple');
      expect(available).toContain('banana');
    });

    it('excludes used suffixes', () => {
      const suffix = nameSuffix.acquireNextAvailableSuffix();
      const available = nameSuffix.getAvailableSuffixes();

      expect(available).not.toContain(suffix);
    });
  });

  describe('integration: acquire and release cycle', () => {
    it('can acquire, release, and reacquire the same suffix', () => {
      const suffix1 = nameSuffix.acquireNextAvailableSuffix();
      nameSuffix.releaseSuffix(suffix1);
      const suffix2 = nameSuffix.acquireNextAvailableSuffix();

      expect(suffix2).toBe(suffix1);
    });

    it('can exhaust and replenish the pool', () => {
      const acquired: string[] = [];
      while (!nameSuffix.isPoolExhausted()) {
        const suffix = nameSuffix.acquireNextAvailableSuffix();
        if (suffix) {
          acquired.push(suffix);
        }
      }

      expect(nameSuffix.acquireNextAvailableSuffix()).toBeUndefined();

      // Release all suffixes
      for (const suffix of acquired) {
        nameSuffix.releaseSuffix(suffix);
      }

      expect(nameSuffix.isPoolExhausted()).toBe(false);
      expect(nameSuffix.acquireNextAvailableSuffix()).toBeDefined();
    });
  });
});
