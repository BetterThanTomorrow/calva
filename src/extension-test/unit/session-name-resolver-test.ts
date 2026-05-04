import * as expectLib from 'expect';
import type * as nrepl from '../../nrepl';
import * as sessionNameResolver from '../../nrepl/session-name-resolver';
import * as sessionRegistry from '../../nrepl/session-registry';
import * as clientRegistry from '../../nrepl/client-registry';
import * as nameSuffix from '../../nrepl/session-name-suffix';

describe('session-name-resolver', () => {
  afterEach(() => {
    sessionRegistry._testUtility_registeredSessions.clear();
    sessionRegistry.setClojureDocsSessionKey(null);
    clientRegistry._testUtility_registeredClients.clear();
    nameSuffix.resetPool();
  });

  const createSession = (clientKey: string): nrepl.NReplSession =>
    ({ client: { clientKey } } as unknown as nrepl.NReplSession);

  const createMockClient = (clientKey: string) => ({ clientKey } as unknown as nrepl.NReplClient);

  describe('resolveSessionNames', () => {
    describe('no conflict scenario', () => {
      it('returns base names when no sessions exist', () => {
        const baseNames = { primary: 'clj', secondary: 'cljs' };

        const resolution = sessionNameResolver.resolveSessionNames(
          baseNames,
          '/project-a',
          'localhost',
          1234
        );

        expectLib.expect(resolution.finalNames).toEqual(baseNames);
        expectLib.expect(resolution.suffix).toBeUndefined();
        expectLib.expect(resolution.reconnectClientKey).toBeUndefined();
      });

      it('returns base names when existing sessions have different keys', () => {
        sessionRegistry.registerSession('bb', createSession('client-a'), {});

        const baseNames = { primary: 'clj', secondary: 'cljs' };
        const resolution = sessionNameResolver.resolveSessionNames(
          baseNames,
          '/project-b',
          'localhost',
          1234
        );

        expectLib.expect(resolution.finalNames).toEqual(baseNames);
        expectLib.expect(resolution.suffix).toBeUndefined();
      });

      it('handles primary-only sessions', () => {
        const baseNames = { primary: 'bb' };

        const resolution = sessionNameResolver.resolveSessionNames(
          baseNames,
          '/project-a',
          'localhost',
          1234
        );

        expectLib.expect(resolution.finalNames).toEqual({ primary: 'bb' });
        expectLib.expect(resolution.suffix).toBeUndefined();
      });
    });

    describe('conflict scenario', () => {
      it('applies suffix when primary key conflicts', () => {
        sessionRegistry.registerSession('clj', createSession('client-a'), {});

        const baseNames = { primary: 'clj', secondary: 'cljs' };
        const resolution = sessionNameResolver.resolveSessionNames(
          baseNames,
          '/project-b',
          'localhost',
          1234
        );

        expectLib.expect(resolution.finalNames.primary).toMatch(/^clj:\w+$/);
        expectLib.expect(resolution.finalNames.secondary).toMatch(/^cljs:\w+$/);
        expectLib.expect(resolution.suffix).toBeDefined();
      });

      it('applies suffix when secondary key conflicts', () => {
        sessionRegistry.registerSession('cljs', createSession('client-a'), {});

        const baseNames = { primary: 'clj', secondary: 'cljs' };
        const resolution = sessionNameResolver.resolveSessionNames(
          baseNames,
          '/project-b',
          'localhost',
          1234
        );

        expectLib.expect(resolution.finalNames.primary).toMatch(/^clj:\w+$/);
        expectLib.expect(resolution.finalNames.secondary).toMatch(/^cljs:\w+$/);
        expectLib.expect(resolution.suffix).toBeDefined();
      });

      it('applies same suffix to both primary and secondary', () => {
        sessionRegistry.registerSession('clj', createSession('client-a'), {});

        const baseNames = { primary: 'clj', secondary: 'cljs' };
        const resolution = sessionNameResolver.resolveSessionNames(
          baseNames,
          '/project-b',
          'localhost',
          1234
        );

        const suffix = resolution.suffix;
        expectLib.expect(resolution.finalNames.primary).toBe(`clj:${suffix}`);
        expectLib.expect(resolution.finalNames.secondary).toBe(`cljs:${suffix}`);
      });

      it('acquires different suffixes for successive conflicts', () => {
        sessionRegistry.registerSession('clj', createSession('client-a'), {});

        const baseNames = { primary: 'clj', secondary: 'cljs' };
        const resolution1 = sessionNameResolver.resolveSessionNames(
          baseNames,
          '/project-b',
          'localhost',
          1234
        );

        // Register the first suffixed session
        sessionRegistry.registerSession(
          resolution1.finalNames.primary,
          createSession('client-b'),
          {}
        );

        const resolution2 = sessionNameResolver.resolveSessionNames(
          baseNames,
          '/project-c',
          'localhost',
          1234
        );

        expectLib.expect(resolution1.suffix).not.toBe(resolution2.suffix);
      });
    });

    describe('reconnection scenario (manual connect)', () => {
      it('detects reconnection when baseNames, host, and port match', () => {
        const baseNames = { primary: 'clj', secondary: 'cljs' };
        const projectRoot = '/project-a';

        clientRegistry.registerClient(createMockClient('client-a'), {
          projectRoot,
          host: 'localhost',
          port: 1234,
          connectionState: {
            baseSessionNames: baseNames,
          },
        });

        const resolution = sessionNameResolver.resolveSessionNames(
          baseNames,
          projectRoot,
          'localhost',
          1234
        );

        expectLib.expect(resolution.reconnectClientKey).toBe('client-a');
        expectLib.expect(resolution.finalNames).toEqual(baseNames);
        expectLib.expect(resolution.suffix).toBeUndefined();
      });

      it('preserves suffix on reconnection', () => {
        const baseNames = { primary: 'clj', secondary: 'cljs' };
        const projectRoot = '/project-a';

        clientRegistry.registerClient(createMockClient('client-a'), {
          projectRoot,
          host: 'localhost',
          port: 1234,
          connectionState: {
            baseSessionNames: baseNames,
            suffix: '2',
          },
        });

        const resolution = sessionNameResolver.resolveSessionNames(
          baseNames,
          projectRoot,
          'localhost',
          1234
        );

        expectLib.expect(resolution.reconnectClientKey).toBe('client-a');
        expectLib.expect(resolution.finalNames).toEqual({ primary: 'clj:2', secondary: 'cljs:2' });
        expectLib.expect(resolution.suffix).toBe('2');
      });

      it('detects reconnection even when projectRoot differs (matches on host:port)', () => {
        const baseNames = { primary: 'clj', secondary: 'cljs' };

        clientRegistry.registerClient(createMockClient('client-a'), {
          projectRoot: '/project-a',
          host: 'localhost',
          port: 1234,
          connectionState: {
            baseSessionNames: baseNames,
          },
        });

        const resolution = sessionNameResolver.resolveSessionNames(
          baseNames,
          '/project-b',
          'localhost',
          1234
        );

        expectLib.expect(resolution.reconnectClientKey).toBe('client-a');
      });

      it('does not detect reconnection when baseNames differ', () => {
        clientRegistry.registerClient(createMockClient('client-a'), {
          projectRoot: '/project-a',
          host: 'localhost',
          port: 1234,
          connectionState: {
            baseSessionNames: { primary: 'clj', secondary: 'cljs' },
          },
        });

        const resolution = sessionNameResolver.resolveSessionNames(
          { primary: 'bb' },
          '/project-a',
          'localhost',
          1234
        );

        expectLib.expect(resolution.reconnectClientKey).toBeUndefined();
        expectLib.expect(resolution.finalNames).toEqual({ primary: 'bb' });
      });

      it('does not detect reconnection when host differs', () => {
        const baseNames = { primary: 'clj', secondary: 'cljs' };
        const projectRoot = '/project-a';

        clientRegistry.registerClient(createMockClient('client-a'), {
          projectRoot,
          host: 'localhost',
          port: 1234,
          connectionState: {
            baseSessionNames: baseNames,
          },
        });

        const resolution = sessionNameResolver.resolveSessionNames(
          baseNames,
          projectRoot,
          'remotehost',
          1234
        );

        expectLib.expect(resolution.reconnectClientKey).toBeUndefined();
      });

      it('does not detect reconnection when port differs', () => {
        const baseNames = { primary: 'clj', secondary: 'cljs' };
        const projectRoot = '/project-a';

        clientRegistry.registerClient(createMockClient('client-a'), {
          projectRoot,
          host: 'localhost',
          port: 1234,
          connectionState: {
            baseSessionNames: baseNames,
          },
        });

        const resolution = sessionNameResolver.resolveSessionNames(
          baseNames,
          projectRoot,
          'localhost',
          5678
        );

        expectLib.expect(resolution.reconnectClientKey).toBeUndefined();
      });
    });

    describe('skipReconnect option', () => {
      it('skips reconnection and treats as conflict when skipReconnect is true', () => {
        const baseNames = { primary: 'clj', secondary: 'cljs' };
        const projectRoot = '/project-a';

        // Register existing client that would normally trigger reconnection
        clientRegistry.registerClient(createMockClient('client-a'), {
          projectRoot,
          host: 'localhost',
          port: 3340,
          connectionState: {
            baseSessionNames: baseNames,
          },
        });
        sessionRegistry.registerSession('clj', createSession('client-a'), {});

        const resolution = sessionNameResolver.resolveSessionNames(
          baseNames,
          projectRoot,
          'localhost',
          3340,
          { skipReconnect: true }
        );

        expectLib.expect(resolution.reconnectClientKey).toBeUndefined();
        expectLib.expect(resolution.suffix).toBeDefined();
        expectLib.expect(resolution.finalNames.primary).toMatch(/^clj:\w+$/);
        expectLib.expect(resolution.finalNames.secondary).toMatch(/^cljs:\w+$/);
      });

      it('still finds reconnection candidate when skipReconnect is false', () => {
        const baseNames = { primary: 'clj', secondary: 'cljs' };
        const projectRoot = '/project-a';

        clientRegistry.registerClient(createMockClient('client-a'), {
          projectRoot,
          host: 'localhost',
          port: 3340,
          connectionState: {
            baseSessionNames: baseNames,
          },
        });

        const resolution = sessionNameResolver.resolveSessionNames(
          baseNames,
          projectRoot,
          'localhost',
          3340,
          { skipReconnect: false }
        );

        expectLib.expect(resolution.reconnectClientKey).toBe('client-a');
      });
    });

    describe('reconnection scenario (port-unaware, e.g. jack-in)', () => {
      it('detects reconnection when baseNames and projectRoot match (port is null)', () => {
        const baseNames = { primary: 'bb' };
        const projectRoot = '/project-a';

        clientRegistry.registerClient(createMockClient('client-a'), {
          projectRoot,
          host: 'localhost',
          port: 1234,
          connectionState: {
            baseSessionNames: baseNames,
          },
        });

        // null port means "don't care about port"
        const resolution = sessionNameResolver.resolveSessionNames(
          baseNames,
          projectRoot,
          'localhost',
          null
        );

        expectLib.expect(resolution.reconnectClientKey).toBe('client-a');
      });

      it('does not detect reconnection when projectRoot differs', () => {
        const baseNames = { primary: 'bb' };

        clientRegistry.registerClient(createMockClient('client-a'), {
          projectRoot: '/project-a',
          host: 'localhost',
          port: 1234,
          connectionState: {
            baseSessionNames: baseNames,
          },
        });

        const resolution = sessionNameResolver.resolveSessionNames(
          baseNames,
          '/project-b',
          'localhost',
          null
        );

        expectLib.expect(resolution.reconnectClientKey).toBeUndefined();
      });

      it('reserves suffix on reconnection so other connections cannot steal it', () => {
        const baseNames = { primary: 'clj', secondary: 'cljs' };
        const projectRoot = '/project-a';

        clientRegistry.registerClient(createMockClient('client-a'), {
          projectRoot,
          host: 'localhost',
          port: 1234,
          connectionState: {
            baseSessionNames: baseNames,
            suffix: 'apple',
          },
        });

        const resolution = sessionNameResolver.resolveSessionNames(
          baseNames,
          projectRoot,
          'localhost',
          1234
        );

        expectLib.expect(resolution.reconnectClientKey).toBe('client-a');
        expectLib.expect(resolution.suffix).toBe('apple');

        expectLib.expect(nameSuffix.getUsedSuffixes()).toContain('apple');
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

        expectLib
          .expect(() => {
            sessionNameResolver.resolveSessionNames(baseNames, '/project-b', 'localhost', 1234);
          })
          .toThrow(/too many REPLs/);
      });
    });
  });

  describe('hasMatchingBaseConnection', () => {
    it('returns true when baseNames and projectRoot match', () => {
      const baseNames = { primary: 'clj', secondary: 'cljs' };
      const projectRoot = '/project-a';

      clientRegistry.registerClient(createMockClient('client-a'), {
        projectRoot,
        host: 'localhost',
        port: 1234,
        connectionState: {
          baseSessionNames: baseNames,
        },
      });

      expectLib
        .expect(sessionNameResolver.hasMatchingBaseConnection(baseNames, projectRoot))
        .toBe(true);
    });

    it('returns true regardless of host/port', () => {
      const baseNames = { primary: 'clj', secondary: 'cljs' };
      const projectRoot = '/project-a';

      clientRegistry.registerClient(createMockClient('client-a'), {
        projectRoot,
        host: 'remotehost',
        port: 9999,
        connectionState: {
          baseSessionNames: baseNames,
        },
      });

      expectLib
        .expect(sessionNameResolver.hasMatchingBaseConnection(baseNames, projectRoot))
        .toBe(true);
    });

    it('returns false when projectRoot differs', () => {
      clientRegistry.registerClient(createMockClient('client-a'), {
        projectRoot: '/project-a',
        connectionState: {
          baseSessionNames: { primary: 'clj', secondary: 'cljs' },
        },
      });

      expectLib
        .expect(
          sessionNameResolver.hasMatchingBaseConnection(
            { primary: 'clj', secondary: 'cljs' },
            '/project-b'
          )
        )
        .toBe(false);
    });

    it('returns false when baseNames differ', () => {
      clientRegistry.registerClient(createMockClient('client-a'), {
        projectRoot: '/project-a',
        connectionState: {
          baseSessionNames: { primary: 'clj', secondary: 'cljs' },
        },
      });

      expectLib
        .expect(sessionNameResolver.hasMatchingBaseConnection({ primary: 'bb' }, '/project-a'))
        .toBe(false);
    });

    it('returns false when no clients registered', () => {
      expectLib
        .expect(sessionNameResolver.hasMatchingBaseConnection({ primary: 'clj' }, '/project-a'))
        .toBe(false);
    });
  });
});
