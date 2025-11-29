import * as expect from 'expect';
import type { NReplSession } from '../../../../src/nrepl';
import * as sessionRouting from '../../../../src/nrepl/session-routing';
import * as sessionRegistry from '../../../../src/nrepl/session-registry';

const createSession = (replType: string, clientKey?: string): NReplSession =>
  ({
    replType,
    client: clientKey ? { clientKey } : undefined,
  } as NReplSession);

describe('session routing preferences', () => {
  beforeEach(() => {
    sessionRegistry.clearAllSessions();
    sessionRouting.resetRouting();
  });

  it('pins a session and overrides resolution', () => {
    sessionRegistry.registerSession('alpha', createSession('clj'), {});
    sessionRegistry.registerSession('beta', createSession('cljs'), {});

    sessionRouting.pinSession('beta');

    expect(sessionRouting.isPinned()).toBe(true);
    expect(sessionRouting.resolvePinnedSession()).toBe('beta');
  });

  it('stores cljc session preference', () => {
    sessionRegistry.registerSession('alpha', createSession('clj'), {});
    sessionRegistry.registerSession('beta', createSession('cljs'), {});

    sessionRouting.setCljcSessionKey('beta');

    expect(sessionRouting.getCljcSessionKey()).toBe('beta');
    // resolvePinnedSession returns undefined when not pinned
    expect(sessionRouting.resolvePinnedSession()).toBeUndefined();
  });

  it('selects a default cljc session when none is configured', () => {
    sessionRegistry.registerSession('alpha', createSession('clj'), {});
    sessionRegistry.registerSession('beta', createSession('cljs'), {});

    expect(sessionRouting.getCljcSessionKey()).toBe('alpha');
  });

  it('falls back to the next available session when clearing the cljc selection', () => {
    sessionRegistry.registerSession('alpha', createSession('clj'), {});
    sessionRegistry.registerSession('beta', createSession('cljs'), {});

    sessionRouting.setCljcSessionKey('beta');
    sessionRouting.setCljcSessionKey(undefined);

    expect(sessionRouting.getCljcSessionKey()).toBe('alpha');
  });

  it('pinned session takes precedence over cljc preference', () => {
    sessionRegistry.registerSession('alpha', createSession('clj'), {});
    sessionRegistry.registerSession('beta', createSession('cljs'), {});

    sessionRouting.setCljcSessionKey('beta');
    sessionRouting.pinSession('alpha');

    expect(sessionRouting.isPinned()).toBe(true);
    // When pinned, resolvePinnedSession returns the pinned session
    expect(sessionRouting.resolvePinnedSession()).toBe('alpha');
  });

  it('falls back to auto routing when the pinned session disappears', () => {
    sessionRegistry.registerSession('alpha', createSession('clj'), {});
    sessionRouting.pinSession('alpha');

    sessionRegistry.unregisterSession('alpha');

    expect(sessionRouting.isPinned()).toBe(false);
    expect(sessionRouting.getRoutingMode()).toBe('auto');
  });
});

describe('multi-client session routing', () => {
  beforeEach(() => {
    sessionRegistry.clearAllSessions();
    sessionRouting.resetRouting();
  });

  it('can pin a session from any client', () => {
    sessionRegistry.registerSession('clj-a', createSession('clj', 'client-a'), {});
    sessionRegistry.registerSession('cljs-a', createSession('cljs', 'client-a'), {});
    sessionRegistry.registerSession('clj-b', createSession('clj', 'client-b'), {});
    sessionRegistry.registerSession('cljs-b', createSession('cljs', 'client-b'), {});

    sessionRouting.pinSession('cljs-b');

    expect(sessionRouting.isPinned()).toBe(true);
    expect(sessionRouting.resolvePinnedSession()).toBe('cljs-b');
  });

  it('pinning overrides regardless of session type', () => {
    sessionRegistry.registerSession('clj-a', createSession('clj', 'client-a'), {});
    sessionRegistry.registerSession('cljs-b', createSession('cljs', 'client-b'), {});

    sessionRouting.pinSession('clj-a');

    // When pinned, the pinned session is always returned
    expect(sessionRouting.resolvePinnedSession()).toBe('clj-a');
  });

  it('cljc preference can target any registered session', () => {
    sessionRegistry.registerSession('clj-a', createSession('clj', 'client-a'), {});
    sessionRegistry.registerSession('cljs-b', createSession('cljs', 'client-b'), {});

    sessionRouting.setCljcSessionKey('cljs-b');

    expect(sessionRouting.getCljcSessionKey()).toBe('cljs-b');
  });

  it('resolvePinnedSession returns undefined when not pinned', () => {
    sessionRegistry.registerSession('clj-a', createSession('clj', 'client-a'), {});
    sessionRegistry.registerSession('cljs-b', createSession('cljs', 'client-b'), {});

    sessionRouting.setCljcSessionKey('cljs-b');

    expect(sessionRouting.resolvePinnedSession()).toBeUndefined();
  });

  it('clears pin when pinned session is unregistered even with multiple clients', () => {
    sessionRegistry.registerSession('clj-a', createSession('clj', 'client-a'), {});
    sessionRegistry.registerSession('clj-b', createSession('clj', 'client-b'), {});

    sessionRouting.pinSession('clj-a');
    sessionRegistry.unregisterSession('clj-a');

    expect(sessionRouting.isPinned()).toBe(false);
    expect(sessionRouting.getRoutingMode()).toBe('auto');
  });

  it('switching pin between sessions from different clients works', () => {
    sessionRegistry.registerSession('clj-a', createSession('clj', 'client-a'), {});
    sessionRegistry.registerSession('cljs-b', createSession('cljs', 'client-b'), {});

    sessionRouting.pinSession('clj-a');
    expect(sessionRouting.resolvePinnedSession()).toBe('clj-a');

    sessionRouting.pinSession('cljs-b');
    expect(sessionRouting.resolvePinnedSession()).toBe('cljs-b');
  });
});
