import * as expectLib from 'expect';
import type * as nrepl from '../../../../src/nrepl';
import * as sessionRegistry from '../../../../src/nrepl/session-registry';
import * as clientRegistry from '../../../../src/nrepl/client-registry';
import * as sessionNameSuffix from '../../../../src/nrepl/session-name-suffix';

describe('session registry', () => {
  afterEach(() => {
    sessionRegistry._testUtility_registeredSessions.clear();
    sessionRegistry.setClojureDocsSessionKey(null);
    clientRegistry._testUtility_registeredClients.clear();
    sessionNameSuffix.resetPool();
  });

  describe('resolveSessionKey', () => {
    it('returns the metadata key when available', () => {
      const session = { replType: 'clj' } as unknown as nrepl.NReplSession;
      (session as any)._calvaSessionMetadata = { key: 'bb' };

      expectLib.expect(sessionRegistry.resolveSessionKey(session)).toBe('bb');
    });

    it('uses the provided fallback when there is no session', () => {
      expectLib.expect(sessionRegistry.resolveSessionKey(undefined, 'custom')).toBe('custom');
    });

    it('uses the default fallback when session has no metadata', () => {
      const session = { replType: 'cljs' } as unknown as nrepl.NReplSession;

      expectLib.expect(sessionRegistry.resolveSessionKey(session)).toBe('clj');
    });
  });

  describe('listSessionsByClient', () => {
    const createSession = (clientKey: string): nrepl.NReplSession =>
      ({ client: { clientKey } } as unknown as nrepl.NReplSession);

    it('returns empty array for empty clientKey', () => {
      sessionRegistry.registerSession('alpha', createSession('client-a'), {});
      expectLib.expect(sessionRegistry.listSessionsByClient('')).toEqual([]);
    });

    it('returns sessions belonging to the specified client', () => {
      sessionRegistry.registerSession('alpha', createSession('client-a'), {});
      sessionRegistry.registerSession('beta', createSession('client-a'), {});
      sessionRegistry.registerSession('gamma', createSession('client-b'), {});

      const sessions = sessionRegistry.listSessionsByClient('client-a');

      expectLib.expect(sessions).toHaveLength(2);
      expectLib.expect(sessions.map((s) => s.key).sort()).toEqual(['alpha', 'beta']);
    });

    it('returns empty array when no sessions match', () => {
      sessionRegistry.registerSession('alpha', createSession('client-a'), {});

      const sessions = sessionRegistry.listSessionsByClient('client-unknown');

      expectLib.expect(sessions).toEqual([]);
    });
  });

  describe('getConnectionStateForSession', () => {
    const createSession = (clientKey: string): nrepl.NReplSession =>
      ({ client: { clientKey } } as unknown as nrepl.NReplSession);

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

      expectLib.expect(state?.cljsBuild).toBe(':app');
      expectLib.expect(state?.cljsTypeName).toBe('shadow-cljs');
    });

    it('returns undefined for unregistered session', () => {
      const state = sessionRegistry.getConnectionStateForSession('unknown');
      expectLib.expect(state).toBeUndefined();
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

      expectLib
        .expect(sessionRegistry.getConnectionStateForSession('alpha')?.cljsBuild)
        .toBe(':app');
      expectLib
        .expect(sessionRegistry.getConnectionStateForSession('beta')?.cljsBuild)
        .toBe(':admin');
    });
  });

  describe('findPrimarySessionForConnection', () => {
    const createSession = (clientKey: string): nrepl.NReplSession =>
      ({ client: { clientKey } } as unknown as nrepl.NReplSession);

    it('finds primary session for same connection', () => {
      sessionRegistry.registerSession('clj', createSession('client-a'), { isSecondary: false });
      sessionRegistry.registerSession('cljs', createSession('client-a'), { isSecondary: true });

      const mainSession = sessionRegistry.findPrimarySessionForConnection('cljs');

      expectLib.expect(mainSession).toBeDefined();
      expectLib.expect((mainSession as any)._calvaSessionMetadata?.key).toBe('clj');
    });

    it('returns undefined when session has no owner', () => {
      const session = { replType: 'clj' } as unknown as nrepl.NReplSession;
      (session as any)._calvaSessionMetadata = { key: 'orphan' };

      const mainSession = sessionRegistry.findPrimarySessionForConnection('orphan');

      expectLib.expect(mainSession).toBeUndefined();
    });

    it('returns undefined when no main session exists', () => {
      sessionRegistry.registerSession('cljs', createSession('client-a'), { isSecondary: true });

      const mainSession = sessionRegistry.findPrimarySessionForConnection('cljs');

      expectLib.expect(mainSession).toBeUndefined();
    });

    it('finds main session across multiple connections', () => {
      sessionRegistry.registerSession('clj-a', createSession('client-a'), { isSecondary: false });
      sessionRegistry.registerSession('cljs-a', createSession('client-a'), { isSecondary: true });
      sessionRegistry.registerSession('clj-b', createSession('client-b'), { isSecondary: false });
      sessionRegistry.registerSession('cljs-b', createSession('client-b'), { isSecondary: true });

      const mainForA = sessionRegistry.findPrimarySessionForConnection('cljs-a');
      const mainForB = sessionRegistry.findPrimarySessionForConnection('cljs-b');

      expectLib.expect((mainForA as any)?._calvaSessionMetadata?.key).toBe('clj-a');
      expectLib.expect((mainForB as any)?._calvaSessionMetadata?.key).toBe('clj-b');
    });
  });

  describe('renameSession', () => {
    const createSession = (clientKey: string): nrepl.NReplSession =>
      ({ client: { clientKey } } as unknown as nrepl.NReplSession);

    const createMockClient = (clientKey: string) =>
      ({ clientKey } as unknown as Parameters<typeof clientRegistry.registerClient>[0]);

    it('renames session: accessible under new key, not under old', () => {
      sessionRegistry.registerSession('epupp', createSession('client-a'), {});

      const result = sessionRegistry.renameSession('epupp', 'epupp-youtube');

      expectLib.expect(result).toBe(true);
      expectLib.expect(sessionRegistry.getSession('epupp-youtube')).toBeDefined();
      expectLib.expect(sessionRegistry.getSession('epupp')).toBeUndefined();
    });

    it('returns false if old key not found', () => {
      const result = sessionRegistry.renameSession('nonexistent', 'new-name');

      expectLib.expect(result).toBe(false);
    });

    it('returns false if new key already exists', () => {
      sessionRegistry.registerSession('alpha', createSession('client-a'), {});
      sessionRegistry.registerSession('beta', createSession('client-b'), {});

      const result = sessionRegistry.renameSession('alpha', 'beta');

      expectLib.expect(result).toBe(false);
      expectLib.expect(sessionRegistry.getSession('alpha')).toBeDefined();
    });

    it('updates sessionRoleKeys for primary session', () => {
      clientRegistry.registerClient(createMockClient('client-a'), {
        connectionState: {
          sessionRoleKeys: { primary: 'clj', secondary: 'cljs' },
        },
      });
      sessionRegistry.registerSession('clj', createSession('client-a'), {});
      sessionRegistry.registerSession('cljs', createSession('client-a'), { isSecondary: true });

      sessionRegistry.renameSession('clj', 'my-clj');

      const state = clientRegistry.getConnectionState('client-a');
      expectLib.expect(state?.sessionRoleKeys?.primary).toBe('my-clj');
      expectLib.expect(state?.sessionRoleKeys?.secondary).toBe('cljs');
    });

    it('updates sessionRoleKeys for secondary session', () => {
      clientRegistry.registerClient(createMockClient('client-a'), {
        connectionState: {
          sessionRoleKeys: { primary: 'clj', secondary: 'cljs' },
        },
      });
      sessionRegistry.registerSession('clj', createSession('client-a'), {});
      sessionRegistry.registerSession('cljs', createSession('client-a'), { isSecondary: true });

      sessionRegistry.renameSession('cljs', 'my-cljs');

      const state = clientRegistry.getConnectionState('client-a');
      expectLib.expect(state?.sessionRoleKeys?.primary).toBe('clj');
      expectLib.expect(state?.sessionRoleKeys?.secondary).toBe('my-cljs');
    });

    it('releases suffix when renaming away from suffixed name', () => {
      const suffix = sessionNameSuffix.acquireNextAvailableSuffix();
      expectLib.expect(suffix).toBe('2');

      clientRegistry.registerClient(createMockClient('client-a'), {
        connectionState: {
          sessionRoleKeys: { primary: 'epupp:2' },
        },
      });
      sessionRegistry.registerSession('epupp:2', createSession('client-a'), {});

      sessionRegistry.renameSession('epupp:2', 'epupp-youtube');

      // Suffix "2" should be released back to the pool
      const nextSuffix = sessionNameSuffix.acquireNextAvailableSuffix();
      expectLib.expect(nextSuffix).toBe('2');
    });
  });
});
