import * as expect from 'expect';
import type { NReplClient, NReplSession } from '../../nrepl';
import * as sessionNameResolver from '../../nrepl/session-name-resolver';
import * as sessionRegistry from '../../nrepl/session-registry';
import * as clientRegistry from '../../nrepl/client-registry';
import * as nameSuffix from '../../nrepl/name-suffix';

describe('session-name-resolver', () => {
  afterEach(() => {
    sessionRegistry._testUtility_registeredSessions.clear();
    sessionRegistry.setClojureDocsSessionKey(null);
    clientRegistry._testUtility_registeredClients.clear();
    nameSuffix.resetPool();
  });

  const createSession = (clientKey: string): NReplSession =>
    ({ client: { clientKey } } as unknown as NReplSession);

  const createMockClient = (clientKey: string) => ({ clientKey } as unknown as NReplClient);

  describe('resolveSessionNames', () => {
    describe('no conflict scenario', () => {
      it('returns base names when no sessions exist', () => {
        const baseNames = { primary: 'clj', secondary: 'cljs' };

        const resolution = sessionNameResolver.resolveSessionNames(baseNames, '/project-a');

        expect(resolution.finalNames).toEqual(baseNames);
        expect(resolution.suffix).toBeUndefined();
        expect(resolution.reconnectClientKey).toBeUndefined();
      });

      it('returns base names when existing sessions have different keys', () => {
        sessionRegistry.registerSession('bb', createSession('client-a'), {});

        const baseNames = { primary: 'clj', secondary: 'cljs' };
        const resolution = sessionNameResolver.resolveSessionNames(baseNames, '/project-b');

        expect(resolution.finalNames).toEqual(baseNames);
        expect(resolution.suffix).toBeUndefined();
      });

      it('handles primary-only sessions', () => {
        const baseNames = { primary: 'bb' };

        const resolution = sessionNameResolver.resolveSessionNames(baseNames, '/project-a');

        expect(resolution.finalNames).toEqual({ primary: 'bb' });
        expect(resolution.suffix).toBeUndefined();
      });
    });

    describe('conflict scenario', () => {
      it('applies suffix when primary key conflicts', () => {
        sessionRegistry.registerSession('clj', createSession('client-a'), {});

        const baseNames = { primary: 'clj', secondary: 'cljs' };
        const resolution = sessionNameResolver.resolveSessionNames(baseNames, '/project-b');

        expect(resolution.finalNames.primary).toMatch(/^clj:\w+$/);
        expect(resolution.finalNames.secondary).toMatch(/^cljs:\w+$/);
        expect(resolution.suffix).toBeDefined();
      });

      it('applies suffix when secondary key conflicts', () => {
        sessionRegistry.registerSession('cljs', createSession('client-a'), {});

        const baseNames = { primary: 'clj', secondary: 'cljs' };
        const resolution = sessionNameResolver.resolveSessionNames(baseNames, '/project-b');

        expect(resolution.finalNames.primary).toMatch(/^clj:\w+$/);
        expect(resolution.finalNames.secondary).toMatch(/^cljs:\w+$/);
        expect(resolution.suffix).toBeDefined();
      });

      it('applies same suffix to both primary and secondary', () => {
        sessionRegistry.registerSession('clj', createSession('client-a'), {});

        const baseNames = { primary: 'clj', secondary: 'cljs' };
        const resolution = sessionNameResolver.resolveSessionNames(baseNames, '/project-b');

        const suffix = resolution.suffix;
        expect(resolution.finalNames.primary).toBe(`clj:${suffix}`);
        expect(resolution.finalNames.secondary).toBe(`cljs:${suffix}`);
      });

      it('acquires different suffixes for successive conflicts', () => {
        sessionRegistry.registerSession('clj', createSession('client-a'), {});

        const baseNames = { primary: 'clj', secondary: 'cljs' };
        const resolution1 = sessionNameResolver.resolveSessionNames(baseNames, '/project-b');

        // Register the first suffixed session
        sessionRegistry.registerSession(
          resolution1.finalNames.primary,
          createSession('client-b'),
          {}
        );

        const resolution2 = sessionNameResolver.resolveSessionNames(baseNames, '/project-c');

        expect(resolution1.suffix).not.toBe(resolution2.suffix);
      });
    });

    describe('reconnection scenario', () => {
      it('detects reconnection with same baseNames and projectRoot', () => {
        const baseNames = { primary: 'clj', secondary: 'cljs' };
        const projectRoot = '/project-a';

        // Register client with baseSessionNames in connection state
        clientRegistry.registerClient(createMockClient('client-a'), {
          projectRoot,
          connectionState: {
            baseSessionNames: baseNames,
          },
        });

        const resolution = sessionNameResolver.resolveSessionNames(baseNames, projectRoot);

        expect(resolution.reconnectClientKey).toBe('client-a');
        expect(resolution.finalNames).toEqual(baseNames);
        expect(resolution.suffix).toBeUndefined();
      });

      it('preserves suffix on reconnection', () => {
        const baseNames = { primary: 'clj', secondary: 'cljs' };
        const projectRoot = '/project-a';

        // Register client with suffix in connection state
        clientRegistry.registerClient(createMockClient('client-a'), {
          projectRoot,
          connectionState: {
            baseSessionNames: baseNames,
            suffix: 'apple',
          },
        });

        const resolution = sessionNameResolver.resolveSessionNames(baseNames, projectRoot);

        expect(resolution.reconnectClientKey).toBe('client-a');
        expect(resolution.finalNames).toEqual({ primary: 'clj:apple', secondary: 'cljs:apple' });
        expect(resolution.suffix).toBe('apple');
      });

      it('does not detect reconnection when projectRoot differs', () => {
        const baseNames = { primary: 'clj', secondary: 'cljs' };

        clientRegistry.registerClient(createMockClient('client-a'), {
          projectRoot: '/project-a',
          connectionState: {
            baseSessionNames: baseNames,
          },
        });

        // Different projectRoot but same baseNames - should NOT be reconnection
        // But sessions exist, so should get suffix
        sessionRegistry.registerSession('clj', createSession('client-a'), {});

        const resolution = sessionNameResolver.resolveSessionNames(baseNames, '/project-b');

        expect(resolution.reconnectClientKey).toBeUndefined();
        expect(resolution.suffix).toBeDefined();
      });

      it('does not detect reconnection when baseNames differ', () => {
        clientRegistry.registerClient(createMockClient('client-a'), {
          projectRoot: '/project-a',
          connectionState: {
            baseSessionNames: { primary: 'clj', secondary: 'cljs' },
          },
        });

        // Same projectRoot but different baseNames - should NOT be reconnection
        const resolution = sessionNameResolver.resolveSessionNames({ primary: 'bb' }, '/project-a');

        expect(resolution.reconnectClientKey).toBeUndefined();
        expect(resolution.finalNames).toEqual({ primary: 'bb' });
      });

      it('reserves suffix on reconnection so other connections cannot steal it', () => {
        const baseNames = { primary: 'clj', secondary: 'cljs' };
        const projectRoot = '/project-a';

        // Simulate a connection that has a suffix
        clientRegistry.registerClient(createMockClient('client-a'), {
          projectRoot,
          connectionState: {
            baseSessionNames: baseNames,
            suffix: 'apple',
          },
        });

        // Reconnection resolution - returns the existing suffix
        const resolution = sessionNameResolver.resolveSessionNames(baseNames, projectRoot);

        expect(resolution.reconnectClientKey).toBe('client-a');
        expect(resolution.suffix).toBe('apple');

        // The suffix should be marked as in-use after resolution
        // so another connection cannot grab it between disconnect and re-register
        expect(nameSuffix.getUsedSuffixes()).toContain('apple');
      });
    });

    describe('pool exhaustion', () => {
      it('throws error when pool is exhausted', () => {
        // Register a conflicting session
        sessionRegistry.registerSession('clj', createSession('client-a'), {});

        // Exhaust the suffix pool
        while (!nameSuffix.isPoolExhausted()) {
          nameSuffix.acquireNextAvailableSuffix();
        }

        const baseNames = { primary: 'clj', secondary: 'cljs' };

        expect(() => {
          sessionNameResolver.resolveSessionNames(baseNames, '/project-b');
        }).toThrow(/too many REPLs/);
      });
    });
  });
});
