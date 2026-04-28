import * as expectLib from 'expect';
import * as sessionLabel from '../../../nrepl/session-label';

describe('session-label', () => {
  describe('determineSessionLabelContext', () => {
    const defaultOptions: sessionLabel.SessionLabelContextOptions = {
      isPinned: false,
      isReplWindow: false,
      isCljcRouting: false,
      fileExtension: 'clj',
    };

    describe('pinned sessions', () => {
      it('returns none for pinned sessions regardless of other context', () => {
        const result = sessionLabel.determineSessionLabelContext({
          ...defaultOptions,
          isPinned: true,
          isReplWindow: true, // Would normally return 'repl-window'
        });
        expectLib.expect(result).toEqual({ type: 'none' });
      });

      it('returns none for pinned sessions even with cljc routing', () => {
        const result = sessionLabel.determineSessionLabelContext({
          ...defaultOptions,
          isPinned: true,
          isCljcRouting: true,
          fileExtension: 'cljc',
        });
        expectLib.expect(result).toEqual({ type: 'none' });
      });
    });

    describe('REPL window context', () => {
      it('returns repl-window when in REPL window', () => {
        const result = sessionLabel.determineSessionLabelContext({
          ...defaultOptions,
          isReplWindow: true,
        });
        expectLib.expect(result).toEqual({ type: 'repl-window' });
      });

      it('prioritizes repl-window over cljc routing', () => {
        const result = sessionLabel.determineSessionLabelContext({
          ...defaultOptions,
          isReplWindow: true,
          isCljcRouting: true,
          fileExtension: 'cljc',
        });
        expectLib.expect(result).toEqual({ type: 'repl-window' });
      });
    });

    describe('cljc routing context', () => {
      it('returns cljc-routing with file extension when isCljcRouting is true', () => {
        const result = sessionLabel.determineSessionLabelContext({
          ...defaultOptions,
          isCljcRouting: true,
          fileExtension: 'cljc',
        });
        expectLib.expect(result).toEqual({ type: 'cljc-routing', fileExtension: 'cljc' });
      });

      it('includes fiddle extension for fiddle files', () => {
        const result = sessionLabel.determineSessionLabelContext({
          ...defaultOptions,
          isCljcRouting: true,
          fileExtension: 'fiddle',
        });
        expectLib.expect(result).toEqual({ type: 'cljc-routing', fileExtension: 'fiddle' });
      });

      it('returns none if cljc routing but no file extension', () => {
        const result = sessionLabel.determineSessionLabelContext({
          ...defaultOptions,
          isCljcRouting: true,
          fileExtension: undefined,
        });
        expectLib.expect(result).toEqual({ type: 'none' });
      });
    });

    describe('no context', () => {
      it('returns none when no special context applies', () => {
        const result = sessionLabel.determineSessionLabelContext({
          ...defaultOptions,
        });
        expectLib.expect(result).toEqual({ type: 'none' });
      });
    });
  });

  describe('formatSessionLabel', () => {
    describe('repl-window context', () => {
      it('prefixes with repl-w/', () => {
        expectLib
          .expect(sessionLabel.formatSessionLabel('cljs', { type: 'repl-window' }))
          .toBe('repl-w/cljs');
      });

      it('works with custom session keys', () => {
        expectLib
          .expect(sessionLabel.formatSessionLabel('frontend', { type: 'repl-window' }))
          .toBe('repl-w/frontend');
      });
    });

    describe('cljc-routing context', () => {
      it('formats as .ext → session for cljc files', () => {
        expectLib
          .expect(
            sessionLabel.formatSessionLabel('clj', { type: 'cljc-routing', fileExtension: 'cljc' })
          )
          .toBe('.cljc → clj');
      });

      it('formats as .ext → session for fiddle files', () => {
        expectLib
          .expect(
            sessionLabel.formatSessionLabel('cljs', {
              type: 'cljc-routing',
              fileExtension: 'fiddle',
            })
          )
          .toBe('.fiddle → cljs');
      });

      it('works with custom session keys', () => {
        expectLib
          .expect(
            sessionLabel.formatSessionLabel('frontend', {
              type: 'cljc-routing',
              fileExtension: 'cljc',
            })
          )
          .toBe('.cljc → frontend');
      });
    });

    describe('no context', () => {
      it('returns session key unchanged', () => {
        expectLib.expect(sessionLabel.formatSessionLabel('clj', { type: 'none' })).toBe('clj');
      });

      it('preserves custom session keys', () => {
        expectLib
          .expect(sessionLabel.formatSessionLabel('backend', { type: 'none' }))
          .toBe('backend');
      });
    });

    describe('various session key formats', () => {
      const contexts: sessionLabel.SessionLabelContext[] = [
        { type: 'repl-window' },
        { type: 'cljc-routing', fileExtension: 'cljc' },
        { type: 'none' },
      ];

      it('handles standard session keys', () => {
        for (const key of ['clj', 'cljs', 'cljc']) {
          for (const context of contexts) {
            const result = sessionLabel.formatSessionLabel(key, context);
            expectLib.expect(typeof result).toBe('string');
            expectLib.expect(result.length).toBeGreaterThan(0);
          }
        }
      });

      it('handles custom session keys with special characters', () => {
        const customKeys = ['frontend-app', 'backend_api', 'my.namespace'];
        for (const key of customKeys) {
          const result = sessionLabel.formatSessionLabel(key, { type: 'none' });
          expectLib.expect(result).toBe(key);
        }
      });
    });
  });
});
