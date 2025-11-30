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
      fileType: 'clj',
      fiddleFileExt: 'fiddle',
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

      it('returns none for pinned sessions with cljc file type', () => {
        const result = determineSessionLabelContext({
          ...defaultOptions,
          isPinned: true,
          fileType: 'cljc',
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

      it('prioritizes repl-window over cljc file type', () => {
        const result = determineSessionLabelContext({
          ...defaultOptions,
          isReplWindow: true,
          fileType: 'cljc',
        });
        expect(result).toBe('repl-window');
      });

      it('prioritizes repl-window over fiddle file type', () => {
        const result = determineSessionLabelContext({
          ...defaultOptions,
          isReplWindow: true,
          fileType: 'fiddle',
        });
        expect(result).toBe('repl-window');
      });
    });

    describe('cljc file context', () => {
      it('returns cljc for cljc file type', () => {
        const result = determineSessionLabelContext({
          ...defaultOptions,
          fileType: 'cljc',
        });
        expect(result).toBe('cljc');
      });
    });

    describe('fiddle file context', () => {
      it('returns fiddle for fiddle file type', () => {
        const result = determineSessionLabelContext({
          ...defaultOptions,
          fileType: 'fiddle',
          fiddleFileExt: 'fiddle',
        });
        expect(result).toBe('fiddle');
      });

      it('matches custom fiddle file extension', () => {
        const result = determineSessionLabelContext({
          ...defaultOptions,
          fileType: 'custom-fiddle',
          fiddleFileExt: 'custom-fiddle',
        });
        expect(result).toBe('fiddle');
      });
    });

    describe('no context', () => {
      it('returns none for regular clj files', () => {
        const result = determineSessionLabelContext({
          ...defaultOptions,
          fileType: 'clj',
        });
        expect(result).toBe('none');
      });

      it('returns none for regular cljs files', () => {
        const result = determineSessionLabelContext({
          ...defaultOptions,
          fileType: 'cljs',
        });
        expect(result).toBe('none');
      });

      it('returns none for edn files', () => {
        const result = determineSessionLabelContext({
          ...defaultOptions,
          fileType: 'edn',
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

    describe('fiddle context', () => {
      it('prefixes with fiddle/', () => {
        expect(formatSessionLabel('cljs', 'fiddle')).toBe('fiddle/cljs');
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
      const contexts: SessionLabelContext[] = ['repl-window', 'cljc', 'fiddle', 'none'];

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
