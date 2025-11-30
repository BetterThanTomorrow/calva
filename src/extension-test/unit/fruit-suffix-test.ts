import * as expect from 'expect';
import * as fruitSuffix from '../../nrepl/fruit-suffix';

describe('fruit-suffix', () => {
  afterEach(() => {
    fruitSuffix.resetPool();
  });

  describe('acquireFruit', () => {
    it('returns an available fruit', () => {
      const fruit = fruitSuffix.acquireFruit();

      expect(fruit).toBeDefined();
      expect(typeof fruit).toBe('string');
    });

    it('returns different fruits on subsequent calls', () => {
      const fruit1 = fruitSuffix.acquireFruit();
      const fruit2 = fruitSuffix.acquireFruit();

      expect(fruit1).not.toBe(fruit2);
    });

    it('marks acquired fruit as used', () => {
      const fruit = fruitSuffix.acquireFruit();

      expect(fruitSuffix.getUsedFruits()).toContain(fruit);
      expect(fruitSuffix.getAvailableFruits()).not.toContain(fruit);
    });
  });

  describe('releaseFruit', () => {
    it('makes a fruit available again', () => {
      const fruit = fruitSuffix.acquireFruit();
      expect(fruitSuffix.getUsedFruits()).toContain(fruit);

      fruitSuffix.releaseFruit(fruit);

      expect(fruitSuffix.getUsedFruits()).not.toContain(fruit);
      expect(fruitSuffix.getAvailableFruits()).toContain(fruit);
    });

    it('is idempotent for unused fruits', () => {
      fruitSuffix.releaseFruit('apple');
      fruitSuffix.releaseFruit('apple');

      expect(fruitSuffix.getUsedFruits()).not.toContain('apple');
    });
  });

  describe('isPoolExhausted', () => {
    it('returns false when fruits are available', () => {
      expect(fruitSuffix.isPoolExhausted()).toBe(false);
    });

    it('returns true when all fruits are used', () => {
      const available = fruitSuffix.getAvailableFruits();
      for (const _ of available) {
        fruitSuffix.acquireFruit();
      }

      expect(fruitSuffix.isPoolExhausted()).toBe(true);
    });

    it('returns false after releasing a fruit from exhausted pool', () => {
      const fruits: string[] = [];
      while (!fruitSuffix.isPoolExhausted()) {
        const fruit = fruitSuffix.acquireFruit();
        if (fruit) {
          fruits.push(fruit);
        }
      }
      expect(fruitSuffix.isPoolExhausted()).toBe(true);

      fruitSuffix.releaseFruit(fruits[0]);

      expect(fruitSuffix.isPoolExhausted()).toBe(false);
    });
  });

  describe('extractFruitSuffix', () => {
    it('extracts fruit suffix from suffixed name', () => {
      expect(fruitSuffix.extractFruitSuffix('clj:apple')).toBe('apple');
      expect(fruitSuffix.extractFruitSuffix('cljs:banana')).toBe('banana');
      expect(fruitSuffix.extractFruitSuffix('my-session:cherry')).toBe('cherry');
    });

    it('returns undefined for names without fruit suffix', () => {
      expect(fruitSuffix.extractFruitSuffix('clj')).toBeUndefined();
      expect(fruitSuffix.extractFruitSuffix('cljs')).toBeUndefined();
      expect(fruitSuffix.extractFruitSuffix('my-session')).toBeUndefined();
    });

    it('returns undefined for names with fruit-like but non-fruit suffix', () => {
      expect(fruitSuffix.extractFruitSuffix('clj:pineapple')).toBeUndefined();
      expect(fruitSuffix.extractFruitSuffix('clj:apples')).toBeUndefined();
    });

    it('only matches suffix, not prefix or middle', () => {
      expect(fruitSuffix.extractFruitSuffix('apple:clj')).toBeUndefined();
      expect(fruitSuffix.extractFruitSuffix('apple')).toBeUndefined();
    });
  });

  describe('applyFruitSuffix', () => {
    it('applies fruit suffix to base name', () => {
      expect(fruitSuffix.applyFruitSuffix('clj', 'apple')).toBe('clj:apple');
      expect(fruitSuffix.applyFruitSuffix('cljs', 'banana')).toBe('cljs:banana');
      expect(fruitSuffix.applyFruitSuffix('my-session', 'cherry')).toBe('my-session:cherry');
    });
  });

  describe('stripFruitSuffix', () => {
    it('strips fruit suffix from suffixed name', () => {
      expect(fruitSuffix.stripFruitSuffix('clj:apple')).toBe('clj');
      expect(fruitSuffix.stripFruitSuffix('cljs:banana')).toBe('cljs');
      expect(fruitSuffix.stripFruitSuffix('my-session:cherry')).toBe('my-session');
    });

    it('returns name unchanged when no fruit suffix', () => {
      expect(fruitSuffix.stripFruitSuffix('clj')).toBe('clj');
      expect(fruitSuffix.stripFruitSuffix('cljs')).toBe('cljs');
      expect(fruitSuffix.stripFruitSuffix('my-session')).toBe('my-session');
    });

    it('returns name unchanged for non-fruit suffixes', () => {
      expect(fruitSuffix.stripFruitSuffix('clj:pineapple')).toBe('clj:pineapple');
    });
  });

  describe('resetPool', () => {
    it('releases all used fruits', () => {
      fruitSuffix.acquireFruit();
      fruitSuffix.acquireFruit();
      fruitSuffix.acquireFruit();
      expect(fruitSuffix.getUsedFruits().length).toBe(3);

      fruitSuffix.resetPool();

      expect(fruitSuffix.getUsedFruits()).toEqual([]);
    });
  });

  describe('getAvailableFruits', () => {
    it('returns all fruits when none are used', () => {
      const available = fruitSuffix.getAvailableFruits();

      expect(available.length).toBeGreaterThan(0);
      expect(available).toContain('apple');
      expect(available).toContain('banana');
    });

    it('excludes used fruits', () => {
      const fruit = fruitSuffix.acquireFruit();
      const available = fruitSuffix.getAvailableFruits();

      expect(available).not.toContain(fruit);
    });
  });

  describe('integration: acquire and release cycle', () => {
    it('can acquire, release, and reacquire the same fruit', () => {
      const fruit1 = fruitSuffix.acquireFruit();
      fruitSuffix.releaseFruit(fruit1);
      const fruit2 = fruitSuffix.acquireFruit();

      expect(fruit2).toBe(fruit1);
    });

    it('can exhaust and replenish the pool', () => {
      const acquired: string[] = [];
      while (!fruitSuffix.isPoolExhausted()) {
        const fruit = fruitSuffix.acquireFruit();
        if (fruit) {
          acquired.push(fruit);
        }
      }

      expect(fruitSuffix.acquireFruit()).toBeUndefined();

      // Release all fruits
      for (const fruit of acquired) {
        fruitSuffix.releaseFruit(fruit);
      }

      expect(fruitSuffix.isPoolExhausted()).toBe(false);
      expect(fruitSuffix.acquireFruit()).toBeDefined();
    });
  });
});
