import { expect } from 'expect';
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
      fileExtension: 'clj',
    };

    describe('pinned sessions', () => {
      it('returns none for pinned sessions regardless of other context', () => {
        const result = determineSessionLabelContext({
          ...defaultOptions,
          isPinned: true,
          isReplWindow: true, // Would normally return 'repl-window'
        });
        expect(result).toEqual({ type: 'none' });
      });

      it('returns none for pinned sessions even with cljc routing', () => {
        const result = determineSessionLabelContext({
          ...defaultOptions,
          isPinned: true,
          isCljcRouting: true,
          fileExtension: 'cljc',
        });
        expect(result).toEqual({ type: 'none' });
      });
    });

    describe('REPL window context', () => {
      it('returns repl-window when in REPL window', () => {
        const result = determineSessionLabelContext({
          ...defaultOptions,
          isReplWindow: true,
        });
        expect(result).toEqual({ type: 'repl-window' });
      });

      it('prioritizes repl-window over cljc routing', () => {
        const result = determineSessionLabelContext({
          ...defaultOptions,
          isReplWindow: true,
          isCljcRouting: true,
          fileExtension: 'cljc',
        });
        expect(result).toEqual({ type: 'repl-window' });
      });
    });

    describe('cljc routing context', () => {
      it('returns cljc-routing with file extension when isCljcRouting is true', () => {
        const result = determineSessionLabelContext({
          ...defaultOptions,
          isCljcRouting: true,
          fileExtension: 'cljc',
        });
        expect(result).toEqual({ type: 'cljc-routing', fileExtension: 'cljc' });
      });

      it('includes fiddle extension for fiddle files', () => {
        const result = determineSessionLabelContext({
          ...defaultOptions,
          isCljcRouting: true,
          fileExtension: 'fiddle',
        });
        expect(result).toEqual({ type: 'cljc-routing', fileExtension: 'fiddle' });
      });

      it('returns none if cljc routing but no file extension', () => {
        const result = determineSessionLabelContext({
          ...defaultOptions,
          isCljcRouting: true,
          fileExtension: undefined,
        });
        expect(result).toEqual({ type: 'none' });
      });
    });

    describe('no context', () => {
      it('returns none when no special context applies', () => {
        const result = determineSessionLabelContext({
          ...defaultOptions,
        });
        expect(result).toEqual({ type: 'none' });
      });
    });
  });

  describe('formatSessionLabel', () => {
    describe('repl-window context', () => {
      it('prefixes with repl-w/', () => {
        expect(formatSessionLabel('cljs', { type: 'repl-window' })).toBe('repl-w/cljs');
      });

      it('works with custom session keys', () => {
        expect(formatSessionLabel('frontend', { type: 'repl-window' })).toBe('repl-w/frontend');
      });
    });

    describe('cljc-routing context', () => {
      it('formats as .ext → session for cljc files', () => {
        expect(formatSessionLabel('clj', { type: 'cljc-routing', fileExtension: 'cljc' })).toBe(
          '.cljc → clj'
        );
      });

      it('formats as .ext → session for fiddle files', () => {
        expect(formatSessionLabel('cljs', { type: 'cljc-routing', fileExtension: 'fiddle' })).toBe(
          '.fiddle → cljs'
        );
      });

      it('works with custom session keys', () => {
        expect(
          formatSessionLabel('frontend', { type: 'cljc-routing', fileExtension: 'cljc' })
        ).toBe('.cljc → frontend');
      });
    });

    describe('no context', () => {
      it('returns session key unchanged', () => {
        expect(formatSessionLabel('clj', { type: 'none' })).toBe('clj');
      });

      it('preserves custom session keys', () => {
        expect(formatSessionLabel('backend', { type: 'none' })).toBe('backend');
      });
    });

    describe('various session key formats', () => {
      const contexts: SessionLabelContext[] = [
        { type: 'repl-window' },
        { type: 'cljc-routing', fileExtension: 'cljc' },
        { type: 'none' },
      ];

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
          const result = formatSessionLabel(key, { type: 'none' });
          expect(result).toBe(key);
        }
      });
    });
  });
});
