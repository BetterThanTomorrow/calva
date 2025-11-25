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
      sessionRegistry.registerSession('alpha', createSession('client-a'), {});
      const analysis = sessionRegistry.analyzeSessionAssignments(['alpha'], 'client-a');

      expect(analysis.summary).toBe('existing-client');
      expect(analysis.statuses[0].occupancy).toBe('same-client');
      expect(analysis.statuses[0].metadata?.connectionOwnerId).toBe('client-a');
    });

    it('flags conflicts for sessions owned by another client', () => {
      sessionRegistry.registerSession('alpha', createSession('client-other'), {});
      const analysis = sessionRegistry.analyzeSessionAssignments(['alpha'], 'client-a');

      expect(analysis.summary).toBe('conflict');
      expect(analysis.statuses[0].occupancy).toBe('conflict');
      expect(analysis.statuses[0].metadata?.connectionOwnerId).toBe('client-other');
    });
  });

  describe('findSingleOwnerForSessions', () => {
    const createSession = (clientKey: string): NReplSession =>
      ({ client: { clientKey } } as unknown as NReplSession);

    it('returns undefined when no sessions are registered', () => {
      const owner = sessionRegistry.findSingleOwnerForSessions(['alpha', 'beta']);

      expect(owner).toBeUndefined();
    });

    it('returns undefined for empty requested keys', () => {
      sessionRegistry.registerSession('alpha', createSession('client-a'), {
        connectionOwnerId: 'client-a',
      });

      const owner = sessionRegistry.findSingleOwnerForSessions([]);

      expect(owner).toBeUndefined();
    });

    it('returns undefined when requested keys contain only undefined values', () => {
      sessionRegistry.registerSession('alpha', createSession('client-a'), {
        connectionOwnerId: 'client-a',
      });

      const owner = sessionRegistry.findSingleOwnerForSessions([undefined, undefined]);

      expect(owner).toBeUndefined();
    });

    it('returns the owner when all sessions belong to a single client', () => {
      sessionRegistry.registerSession('alpha', createSession('client-a'), {
        connectionOwnerId: 'client-a',
      });
      sessionRegistry.registerSession('beta', createSession('client-a'), {
        connectionOwnerId: 'client-a',
      });

      const owner = sessionRegistry.findSingleOwnerForSessions(['alpha', 'beta']);

      expect(owner).toBe('client-a');
    });

    it('returns undefined when sessions belong to multiple clients', () => {
      sessionRegistry.registerSession('alpha', createSession('client-a'), {
        connectionOwnerId: 'client-a',
      });
      sessionRegistry.registerSession('beta', createSession('client-b'), {
        connectionOwnerId: 'client-b',
      });

      const owner = sessionRegistry.findSingleOwnerForSessions(['alpha', 'beta']);

      expect(owner).toBeUndefined();
    });

    it('returns the owner when some requested sessions are unregistered', () => {
      sessionRegistry.registerSession('alpha', createSession('client-a'), {
        connectionOwnerId: 'client-a',
      });

      const owner = sessionRegistry.findSingleOwnerForSessions(['alpha', 'gamma']);

      expect(owner).toBe('client-a');
    });

    it('filters out undefined keys from the request', () => {
      sessionRegistry.registerSession('alpha', createSession('client-a'), {
        connectionOwnerId: 'client-a',
      });

      const owner = sessionRegistry.findSingleOwnerForSessions(['alpha', undefined, 'beta']);

      expect(owner).toBe('client-a');
    });

    it('deduplicates requested keys', () => {
      sessionRegistry.registerSession('alpha', createSession('client-a'), {
        connectionOwnerId: 'client-a',
      });

      const owner = sessionRegistry.findSingleOwnerForSessions(['alpha', 'alpha', 'alpha']);

      expect(owner).toBe('client-a');
    });
  });
});
