import * as expect from 'expect';
import type { NReplSession } from '../../../../src/nrepl';
import * as sessionRegistry from '../../../../src/nrepl/session-registry';

describe('session registry', () => {
  afterEach(() => {
    sessionRegistry.clearAllSessions();
  });

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

  describe('analyzeSessionAssignments', () => {
    const createSession = (clientKey: string): NReplSession =>
      ({ client: { clientKey } } as unknown as NReplSession);

    it('marks requested keys as available when not registered', () => {
      const analysis = sessionRegistry.analyzeSessionAssignments(['alpha', 'beta'], 'client-a');

      expect(analysis.summary).toBe('available');
      expect(analysis.statuses).toEqual([
        { key: 'alpha', occupancy: 'available' },
        { key: 'beta', occupancy: 'available' },
      ]);
    });

    it('recognizes when keys are already attached to the requesting client', () => {
      sessionRegistry.registerSession('alpha', createSession('client-a'), { name: 'Primary' });
      const analysis = sessionRegistry.analyzeSessionAssignments(['alpha'], 'client-a');

      expect(analysis.summary).toBe('existing-client');
      expect(analysis.statuses[0].occupancy).toBe('same-client');
      expect(analysis.statuses[0].metadata?.clientKey).toBe('client-a');
    });

    it('flags conflicts for sessions owned by another client', () => {
      sessionRegistry.registerSession('alpha', createSession('client-other'), { name: 'Primary' });
      const analysis = sessionRegistry.analyzeSessionAssignments(['alpha'], 'client-a');

      expect(analysis.summary).toBe('conflict');
      expect(analysis.statuses[0].occupancy).toBe('conflict');
      expect(analysis.statuses[0].metadata?.clientKey).toBe('client-other');
    });
  });
});
