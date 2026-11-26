import * as expectLib from 'expect';
import type * as nrepl from '../../../../src/nrepl';
import * as clientRegistry from '../../../../src/nrepl/client-registry';
import * as sessionRegistry from '../../../../src/nrepl/session-registry';
import { listConnections } from '../../../../src/nrepl/list-connections';

const createClient = (key: string): nrepl.NReplClient =>
  ({
    clientKey: key,
  } as unknown as nrepl.NReplClient);

const createSession = (clientKey: string): nrepl.NReplSession =>
  ({ client: { clientKey } } as unknown as nrepl.NReplSession);

describe('listConnections', () => {
  afterEach(() => {
    sessionRegistry._testUtility_registeredSessions.clear();
    clientRegistry._testUtility_registeredClients.clear();
  });

  it('returns an empty list when there are no connections', () => {
    expectLib.expect(listConnections()).toEqual([]);
  });

  it('returns one connection with its session keys', () => {
    clientRegistry.registerClient(createClient('nrepl-client-1'), {
      host: 'localhost',
      port: 7888,
      projectRoot: 'file:///tmp/project-a',
    });
    sessionRegistry.registerSession('clj', createSession('nrepl-client-1'), {});
    sessionRegistry.registerSession('cljs', createSession('nrepl-client-1'), {
      isSecondary: true,
    });

    expectLib.expect(listConnections()).toEqual([
      {
        clientKey: 'nrepl-client-1',
        host: 'localhost',
        port: 7888,
        projectRoot: 'file:///tmp/project-a',
        replSessionKeys: ['clj', 'cljs'],
      },
    ]);
  });

  it('returns two connections that share a project root with their own session keys', () => {
    const sharedRoot = 'file:///tmp/shared';
    clientRegistry.registerClient(createClient('nrepl-client-1'), {
      host: 'localhost',
      port: 7888,
      projectRoot: sharedRoot,
    });
    clientRegistry.registerClient(createClient('nrepl-client-2'), {
      host: '127.0.0.1',
      port: 7889,
      projectRoot: sharedRoot,
    });
    sessionRegistry.registerSession('clj', createSession('nrepl-client-1'), {});
    sessionRegistry.registerSession('bb', createSession('nrepl-client-2'), {});

    expectLib.expect(listConnections()).toEqual([
      {
        clientKey: 'nrepl-client-1',
        host: 'localhost',
        port: 7888,
        projectRoot: sharedRoot,
        replSessionKeys: ['clj'],
      },
      {
        clientKey: 'nrepl-client-2',
        host: '127.0.0.1',
        port: 7889,
        projectRoot: sharedRoot,
        replSessionKeys: ['bb'],
      },
    ]);
  });
});
