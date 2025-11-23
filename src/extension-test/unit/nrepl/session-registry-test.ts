import * as expect from 'expect';
import type { NReplSession } from '../../../../src/nrepl';
import * as sessionRegistry from '../../../../src/nrepl/session-registry';

describe('session registry', () => {
  describe('resolveSessionKey', () => {
    it('returns the metadata key when available', () => {
      const session = { replType: 'clj' } as unknown as NReplSession;
      (session as any)._calvaSessionMetadata = { key: 'bb' };

      expect(sessionRegistry.resolveSessionKey(session)).toBe('bb');
    });

    it('falls back to the session replType when metadata key is missing', () => {
      const session = { replType: 'cljs' } as unknown as NReplSession;

      expect(sessionRegistry.resolveSessionKey(session)).toBe('cljs');
    });

    it('uses the provided fallback when there is no session', () => {
      expect(sessionRegistry.resolveSessionKey(undefined, 'custom')).toBe('custom');
    });
  });
});
