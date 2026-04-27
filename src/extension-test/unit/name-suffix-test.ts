import * as expectLib from 'expect';
import * as nameSuffix from '../../nrepl/session-name-suffix';

describe('name-suffix', () => {
  afterEach(() => {
    nameSuffix.resetPool();
  });

  describe('acquireNextAvailableSuffix', () => {
    it('returns an available suffix', () => {
      const suffix = nameSuffix.acquireNextAvailableSuffix();

      expectLib.expect(suffix).toBeDefined();
      expectLib.expect(typeof suffix).toBe('string');
    });

    it('returns different suffixes on subsequent calls', () => {
      const suffix1 = nameSuffix.acquireNextAvailableSuffix();
      const suffix2 = nameSuffix.acquireNextAvailableSuffix();

      expectLib.expect(suffix1).not.toBe(suffix2);
    });

    it('marks acquired suffix as used', () => {
      const suffix = nameSuffix.acquireNextAvailableSuffix();

      expectLib.expect(nameSuffix.getUsedSuffixes()).toContain(suffix);
      expectLib.expect(nameSuffix.getAvailableSuffixes()).not.toContain(suffix);
    });
  });

  describe('releaseSuffix', () => {
    it('makes a suffix available again', () => {
      const suffix = nameSuffix.acquireNextAvailableSuffix();
      expectLib.expect(nameSuffix.getUsedSuffixes()).toContain(suffix);

      nameSuffix.releaseSuffix(suffix);

      expectLib.expect(nameSuffix.getUsedSuffixes()).not.toContain(suffix);
      expectLib.expect(nameSuffix.getAvailableSuffixes()).toContain(suffix);
    });

    it('is idempotent for unused suffixes', () => {
      nameSuffix.releaseSuffix('apple');
      nameSuffix.releaseSuffix('apple');

      expectLib.expect(nameSuffix.getUsedSuffixes()).not.toContain('apple');
    });
  });

  describe('reserveSuffix', () => {
    it('reserves a specific suffix, marking it as used', () => {
      const result = nameSuffix.reserveSuffix('apple');

      expectLib.expect(result).toBe(true);
      expectLib.expect(nameSuffix.getUsedSuffixes()).toContain('apple');
      expectLib.expect(nameSuffix.getAvailableSuffixes()).not.toContain('apple');
    });

    it('returns false if the suffix is already in use', () => {
      nameSuffix.reserveSuffix('apple');
      const result = nameSuffix.reserveSuffix('apple');

      expectLib.expect(result).toBe(false);
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

      expectLib.expect(acquired).not.toContain('apple');
    });

    it('allows re-reserving a suffix after it has been released', () => {
      nameSuffix.reserveSuffix('apple');
      nameSuffix.releaseSuffix('apple');
      const result = nameSuffix.reserveSuffix('apple');

      expectLib.expect(result).toBe(true);
      expectLib.expect(nameSuffix.getUsedSuffixes()).toContain('apple');
    });
  });

  describe('isPoolExhausted', () => {
    it('returns false when suffixes are available', () => {
      expectLib.expect(nameSuffix.isPoolExhausted()).toBe(false);
    });

    it('returns true when all suffixes are used', () => {
      const available = nameSuffix.getAvailableSuffixes();
      for (const _ of available) {
        nameSuffix.acquireNextAvailableSuffix();
      }

      expectLib.expect(nameSuffix.isPoolExhausted()).toBe(true);
    });

    it('returns false after releasing a suffix from exhausted pool', () => {
      const suffixes: string[] = [];
      while (!nameSuffix.isPoolExhausted()) {
        const suffix = nameSuffix.acquireNextAvailableSuffix();
        if (suffix) {
          suffixes.push(suffix);
        }
      }
      expectLib.expect(nameSuffix.isPoolExhausted()).toBe(true);

      nameSuffix.releaseSuffix(suffixes[0]);

      expectLib.expect(nameSuffix.isPoolExhausted()).toBe(false);
    });
  });

  describe('extractSuffix', () => {
    it('extracts suffix from suffixed name', () => {
      expectLib.expect(nameSuffix.extractSuffix('clj:2')).toBe('2');
      expectLib.expect(nameSuffix.extractSuffix('cljs:3')).toBe('3');
      expectLib.expect(nameSuffix.extractSuffix('my-session:4')).toBe('4');
    });

    it('returns undefined for names without suffix', () => {
      expectLib.expect(nameSuffix.extractSuffix('clj')).toBeUndefined();
      expectLib.expect(nameSuffix.extractSuffix('cljs')).toBeUndefined();
      expectLib.expect(nameSuffix.extractSuffix('my-session')).toBeUndefined();
    });

    it('returns undefined for names with non-pool suffix', () => {
      expectLib.expect(nameSuffix.extractSuffix('clj:a')).toBeUndefined();
      expectLib.expect(nameSuffix.extractSuffix('clj:b')).toBeUndefined();
    });

    it('only matches suffix, not prefix or middle', () => {
      expectLib.expect(nameSuffix.extractSuffix('2:clj')).toBeUndefined();
      expectLib.expect(nameSuffix.extractSuffix('2')).toBeUndefined();
    });
  });

  describe('applySuffix', () => {
    it('applies suffix to base name', () => {
      expectLib.expect(nameSuffix.applySuffix('clj', '2')).toBe('clj:2');
      expectLib.expect(nameSuffix.applySuffix('cljs', '3')).toBe('cljs:3');
      expectLib.expect(nameSuffix.applySuffix('my-session', '4')).toBe('my-session:4');
    });
  });

  describe('stripSuffix', () => {
    it('strips suffix from suffixed name', () => {
      expectLib.expect(nameSuffix.stripSuffix('clj:2')).toBe('clj');
      expectLib.expect(nameSuffix.stripSuffix('cljs:3')).toBe('cljs');
      expectLib.expect(nameSuffix.stripSuffix('my-session:4')).toBe('my-session');
    });

    it('returns name unchanged when no suffix', () => {
      expectLib.expect(nameSuffix.stripSuffix('clj')).toBe('clj');
      expectLib.expect(nameSuffix.stripSuffix('cljs')).toBe('cljs');
      expectLib.expect(nameSuffix.stripSuffix('my-session')).toBe('my-session');
    });

    it('returns name unchanged for non-pool suffixes', () => {
      expectLib.expect(nameSuffix.stripSuffix('clj:tiger')).toBe('clj:tiger');
    });
  });

  describe('resetPool', () => {
    it('releases all used suffixes', () => {
      nameSuffix.acquireNextAvailableSuffix();
      nameSuffix.acquireNextAvailableSuffix();
      nameSuffix.acquireNextAvailableSuffix();
      expectLib.expect(nameSuffix.getUsedSuffixes().length).toBe(3);

      nameSuffix.resetPool();

      expectLib.expect(nameSuffix.getUsedSuffixes()).toEqual([]);
    });
  });

  describe('getAvailableSuffixes', () => {
    it('returns all suffixes when none are used', () => {
      const available = nameSuffix.getAvailableSuffixes();

      expectLib.expect(available.length).toBeGreaterThan(0);
      expectLib.expect(available).toContain('2');
      expectLib.expect(available).toContain('3');
    });

    it('excludes used suffixes', () => {
      const suffix = nameSuffix.acquireNextAvailableSuffix();
      const available = nameSuffix.getAvailableSuffixes();

      expectLib.expect(available).not.toContain(suffix);
    });
  });

  describe('integration: acquire and release cycle', () => {
    it('can acquire, release, and reacquire the same suffix', () => {
      const suffix1 = nameSuffix.acquireNextAvailableSuffix();
      nameSuffix.releaseSuffix(suffix1);
      const suffix2 = nameSuffix.acquireNextAvailableSuffix();

      expectLib.expect(suffix2).toBe(suffix1);
    });

    it('can exhaust and replenish the pool', () => {
      const acquired: string[] = [];
      while (!nameSuffix.isPoolExhausted()) {
        const suffix = nameSuffix.acquireNextAvailableSuffix();
        if (suffix) {
          acquired.push(suffix);
        }
      }

      expectLib.expect(nameSuffix.acquireNextAvailableSuffix()).toBeUndefined();

      // Release all suffixes
      for (const suffix of acquired) {
        nameSuffix.releaseSuffix(suffix);
      }

      expectLib.expect(nameSuffix.isPoolExhausted()).toBe(false);
      expectLib.expect(nameSuffix.acquireNextAvailableSuffix()).toBeDefined();
    });
  });
});
