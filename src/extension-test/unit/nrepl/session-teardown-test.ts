import { expect } from 'expect';
import type { NReplSession } from '../../../../src/nrepl';
import * as sessionRegistry from '../../../../src/nrepl/session-registry';
import * as sessionRouting from '../../../../src/nrepl/session-routing';
import * as teardown from '../../../../src/nrepl/session-teardown-core';

const createSession = (clientKey: string): NReplSession =>
  ({
    client: { clientKey },
  } as NReplSession);

describe('session teardown', () => {
  beforeEach(() => {
    sessionRegistry._testUtility_registeredSessions.clear();
    sessionRegistry.setClojureDocsSessionKey(null);
    sessionRouting.resetRouting();
  });

  afterEach(() => {
    sessionRegistry._testUtility_registeredSessions.clear();
    sessionRegistry.setClojureDocsSessionKey(null);
    sessionRouting.resetRouting();
  });

  it('removes all sessions registered to a client', () => {
    sessionRegistry.registerSession('alpha', createSession('client'), {});
    sessionRegistry.registerSession('beta', createSession('client'), {});
    sessionRegistry.registerSession('gamma', createSession('other'), {});

    const removed = teardown.teardownSessionsForClient('client');

    expect(removed.sort()).toEqual(['alpha', 'beta']);
    const remaining = sessionRegistry.listSessions().map((meta) => meta.key);
    expect(remaining).toEqual(['gamma']);
  });

  it('clears routing references to removed session keys', () => {
    sessionRegistry.registerSession('alpha', createSession('client'), {});
    sessionRegistry.registerSession('beta', createSession('client'), {});

    sessionRouting.pinSession('alpha');

    teardown.teardownSessionKeys(['alpha', 'beta']);

    expect(sessionRouting.getPinnedSessionKey()).toBeUndefined();
  });
});
