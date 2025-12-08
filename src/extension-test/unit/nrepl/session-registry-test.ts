import * as expect from 'expect';
import type { NReplSession } from '../../../../src/nrepl';
import * as sessionRegistry from '../../../../src/nrepl/session-registry';
import * as clientRegistry from '../../../../src/nrepl/client-registry';

describe('session registry', () => {
  afterEach(() => {
    sessionRegistry.clearAllSessions();
    clientRegistry.clearAllClients();
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

  describe('listSessionsByClient', () => {
    const createSession = (clientKey: string): NReplSession =>
      ({ client: { clientKey } } as unknown as NReplSession);

    it('returns empty array for empty clientKey', () => {
      sessionRegistry.registerSession('alpha', createSession('client-a'), {});
      expect(sessionRegistry.listSessionsByClient('')).toEqual([]);
    });

    it('returns sessions belonging to the specified client', () => {
      sessionRegistry.registerSession('alpha', createSession('client-a'), {});
      sessionRegistry.registerSession('beta', createSession('client-a'), {});
      sessionRegistry.registerSession('gamma', createSession('client-b'), {});

      const sessions = sessionRegistry.listSessionsByClient('client-a');

      expect(sessions).toHaveLength(2);
      expect(sessions.map((s) => s.key).sort()).toEqual(['alpha', 'beta']);
    });

    it('returns empty array when no sessions match', () => {
      sessionRegistry.registerSession('alpha', createSession('client-a'), {});

      const sessions = sessionRegistry.listSessionsByClient('client-unknown');

      expect(sessions).toEqual([]);
    });
  });

  describe('getConnectionStateForSession', () => {
    const createSession = (clientKey: string): NReplSession =>
      ({ client: { clientKey } } as unknown as NReplSession);

    const createMockClient = (clientKey: string) =>
      ({ clientKey } as unknown as Parameters<typeof clientRegistry.registerClient>[0]);

    it('returns connection state for the session owner', () => {
      clientRegistry.registerClient(createMockClient('client-a'), {
        connectionState: {
          cljsBuild: ':app',
          cljsTypeName: 'shadow-cljs',
        },
      });
      sessionRegistry.registerSession('alpha', createSession('client-a'), {});

      const state = sessionRegistry.getConnectionStateForSession('alpha');

      expect(state?.cljsBuild).toBe(':app');
      expect(state?.cljsTypeName).toBe('shadow-cljs');
    });

    it('returns undefined for unregistered session', () => {
      const state = sessionRegistry.getConnectionStateForSession('unknown');
      expect(state).toBeUndefined();
    });

    it('returns correct state when multiple clients exist', () => {
      clientRegistry.registerClient(createMockClient('client-a'), {
        connectionState: { cljsBuild: ':app' },
      });
      clientRegistry.registerClient(createMockClient('client-b'), {
        connectionState: { cljsBuild: ':admin' },
      });
      sessionRegistry.registerSession('alpha', createSession('client-a'), {});
      sessionRegistry.registerSession('beta', createSession('client-b'), {});

      expect(sessionRegistry.getConnectionStateForSession('alpha')?.cljsBuild).toBe(':app');
      expect(sessionRegistry.getConnectionStateForSession('beta')?.cljsBuild).toBe(':admin');
    });
  });

  describe('findPrimarySessionForConnection', () => {
    const createSession = (clientKey: string): NReplSession =>
      ({ client: { clientKey } } as unknown as NReplSession);

    it('finds primary session for same connection', () => {
      sessionRegistry.registerSession('clj', createSession('client-a'), { isSecondary: false });
      sessionRegistry.registerSession('cljs', createSession('client-a'), { isSecondary: true });

      const mainSession = sessionRegistry.findPrimarySessionForConnection('cljs');

      expect(mainSession).toBeDefined();
      expect((mainSession as any)._calvaSessionMetadata?.key).toBe('clj');
    });

    it('returns undefined when session has no owner', () => {
      const session = { replType: 'clj' } as unknown as NReplSession;
      (session as any)._calvaSessionMetadata = { key: 'orphan' };

      const mainSession = sessionRegistry.findPrimarySessionForConnection('orphan');

      expect(mainSession).toBeUndefined();
    });

    it('returns undefined when no main session exists', () => {
      sessionRegistry.registerSession('cljs', createSession('client-a'), { isSecondary: true });

      const mainSession = sessionRegistry.findPrimarySessionForConnection('cljs');

      expect(mainSession).toBeUndefined();
    });

    it('finds main session across multiple connections', () => {
      sessionRegistry.registerSession('clj-a', createSession('client-a'), { isSecondary: false });
      sessionRegistry.registerSession('cljs-a', createSession('client-a'), { isSecondary: true });
      sessionRegistry.registerSession('clj-b', createSession('client-b'), { isSecondary: false });
      sessionRegistry.registerSession('cljs-b', createSession('client-b'), { isSecondary: true });

      const mainForA = sessionRegistry.findPrimarySessionForConnection('cljs-a');
      const mainForB = sessionRegistry.findPrimarySessionForConnection('cljs-b');

      expect((mainForA as any)?._calvaSessionMetadata?.key).toBe('clj-a');
      expect((mainForB as any)?._calvaSessionMetadata?.key).toBe('clj-b');
    });
  });
});
