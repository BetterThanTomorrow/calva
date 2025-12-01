import * as expect from 'expect';
import {
  determineSessionLabelContext,
  formatSessionLabel,
  type SessionLabelContext,
  type SessionLabelContextOptions,
} from '../../../nrepl/session-label';

describe('session-label', () => {
  describe('determineSessionLabelContext', () => {
    const defaultOptions: SessionLabelContextOptions = {
      isPinned: false,
      isReplWindow: false,
      isCljcRouting: false,
    };

    describe('pinned sessions', () => {
      it('returns none for pinned sessions regardless of other context', () => {
        const result = determineSessionLabelContext({
          ...defaultOptions,
          isPinned: true,
          isReplWindow: true, // Would normally return 'repl-window'
        });
        expect(result).toBe('none');
      });

      it('returns none for pinned sessions even with cljc routing', () => {
        const result = determineSessionLabelContext({
          ...defaultOptions,
          isPinned: true,
          isCljcRouting: true,
        });
        expect(result).toBe('none');
      });
    });

    describe('REPL window context', () => {
      it('returns repl-window when in REPL window', () => {
        const result = determineSessionLabelContext({
          ...defaultOptions,
          isReplWindow: true,
        });
        expect(result).toBe('repl-window');
      });

      it('prioritizes repl-window over cljc routing', () => {
        const result = determineSessionLabelContext({
          ...defaultOptions,
          isReplWindow: true,
          isCljcRouting: true,
        });
        expect(result).toBe('repl-window');
      });
    });

    describe('cljc routing context', () => {
      it('returns cljc when isCljcRouting is true', () => {
        const result = determineSessionLabelContext({
          ...defaultOptions,
          isCljcRouting: true,
        });
        expect(result).toBe('cljc');
      });
    });

    describe('no context', () => {
      it('returns none when no special context applies', () => {
        const result = determineSessionLabelContext({
          ...defaultOptions,
        });
        expect(result).toBe('none');
      });
    });
  });

  describe('formatSessionLabel', () => {
    describe('repl-window context', () => {
      it('prefixes with repl-w/', () => {
        expect(formatSessionLabel('cljs', 'repl-window')).toBe('repl-w/cljs');
      });

      it('works with custom session keys', () => {
        expect(formatSessionLabel('frontend', 'repl-window')).toBe('repl-w/frontend');
      });
    });

    describe('cljc context', () => {
      it('prefixes with cljc/', () => {
        expect(formatSessionLabel('clj', 'cljc')).toBe('cljc/clj');
      });

      it('works with cljs session', () => {
        expect(formatSessionLabel('cljs', 'cljc')).toBe('cljc/cljs');
      });
    });

    describe('no context', () => {
      it('returns session key unchanged', () => {
        expect(formatSessionLabel('clj', 'none')).toBe('clj');
      });

      it('preserves custom session keys', () => {
        expect(formatSessionLabel('backend', 'none')).toBe('backend');
      });
    });

    describe('various session key formats', () => {
      const contexts: SessionLabelContext[] = ['repl-window', 'cljc', 'none'];

      it('handles standard session keys', () => {
        for (const key of ['clj', 'cljs', 'cljc']) {
          for (const context of contexts) {
            const result = formatSessionLabel(key, context);
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
          }
        }
      });

      it('handles custom session keys with special characters', () => {
        const customKeys = ['frontend-app', 'backend_api', 'my.namespace'];
        for (const key of customKeys) {
          const result = formatSessionLabel(key, 'none');
          expect(result).toBe(key);
        }
      });
    });
  });
});
