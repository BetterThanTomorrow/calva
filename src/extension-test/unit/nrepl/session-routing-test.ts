import * as expectLib from 'expect';
import type * as nrepl from '../../../../src/nrepl';
import * as sessionRouting from '../../../../src/nrepl/session-routing';
import * as sessionRegistry from '../../../../src/nrepl/session-registry';

const createSession = (replType: string, clientKey?: string): nrepl.NReplSession =>
  ({
    replType,
    client: clientKey ? { clientKey } : undefined,
  } as nrepl.NReplSession);

describe('session routing preferences', () => {
  beforeEach(() => {
    sessionRegistry._testUtility_registeredSessions.clear();
    sessionRegistry.setClojureDocsSessionKey(null);
    sessionRouting.resetRouting();
  });

  it('pins a session and overrides resolution', () => {
    sessionRegistry.registerSession('alpha', createSession('clj'), {});
    sessionRegistry.registerSession('beta', createSession('cljs'), {});

    sessionRouting.pinSession('beta');

    expectLib.expect(sessionRouting.isPinned()).toBe(true);
    expectLib.expect(sessionRouting.resolvePinnedSession()).toBe('beta');
  });

  it('falls back to auto routing when the pinned session disappears', () => {
    sessionRegistry.registerSession('alpha', createSession('clj'), {});
    sessionRouting.pinSession('alpha');

    sessionRegistry.unregisterSession('alpha');

    expectLib.expect(sessionRouting.isPinned()).toBe(false);
    expectLib.expect(sessionRouting.getRoutingMode()).toBe('auto');
  });
});

describe('session routing change events', () => {
  beforeEach(() => {
    sessionRegistry._testUtility_registeredSessions.clear();
    sessionRegistry.setClojureDocsSessionKey(null);
    sessionRouting.resetRouting();
  });

  it('notifies listeners when routing is pinned or reset to auto', () => {
    const events: string[] = [];
    const disposable = sessionRouting.onDidChangeRouting(() => events.push('changed'));

    sessionRegistry.registerSession('alpha', createSession('clj'), {});
    sessionRouting.pinSession('alpha');
    sessionRouting.enableAutoRouting();
    disposable.dispose();

    expectLib.expect(events).toEqual(['changed', 'changed']);
  });

  it('does not notify disposed listeners', () => {
    const events: string[] = [];
    const disposable = sessionRouting.onDidChangeRouting(() => events.push('changed'));

    disposable.dispose();
    sessionRouting.pinSession('alpha');

    expectLib.expect(events).toEqual([]);
  });
});

describe('multi-client session routing', () => {
  beforeEach(() => {
    sessionRegistry._testUtility_registeredSessions.clear();
    sessionRegistry.setClojureDocsSessionKey(null);
    sessionRouting.resetRouting();
  });

  it('can pin a session from any client', () => {
    sessionRegistry.registerSession('clj-a', createSession('clj', 'client-a'), {});
    sessionRegistry.registerSession('cljs-a', createSession('cljs', 'client-a'), {});
    sessionRegistry.registerSession('clj-b', createSession('clj', 'client-b'), {});
    sessionRegistry.registerSession('cljs-b', createSession('cljs', 'client-b'), {});

    sessionRouting.pinSession('cljs-b');

    expectLib.expect(sessionRouting.isPinned()).toBe(true);
    expectLib.expect(sessionRouting.resolvePinnedSession()).toBe('cljs-b');
  });

  it('pinning overrides regardless of session type', () => {
    sessionRegistry.registerSession('clj-a', createSession('clj', 'client-a'), {});
    sessionRegistry.registerSession('cljs-b', createSession('cljs', 'client-b'), {});

    sessionRouting.pinSession('clj-a');

    // When pinned, the pinned session is always returned
    expectLib.expect(sessionRouting.resolvePinnedSession()).toBe('clj-a');
  });

  it('resolvePinnedSession returns undefined when not pinned', () => {
    sessionRegistry.registerSession('clj-a', createSession('clj', 'client-a'), {});
    sessionRegistry.registerSession('cljs-b', createSession('cljs', 'client-b'), {});

    expectLib.expect(sessionRouting.resolvePinnedSession()).toBeUndefined();
  });

  it('clears pin when pinned session is unregistered even with multiple clients', () => {
    sessionRegistry.registerSession('clj-a', createSession('clj', 'client-a'), {});
    sessionRegistry.registerSession('clj-b', createSession('clj', 'client-b'), {});

    sessionRouting.pinSession('clj-a');
    sessionRegistry.unregisterSession('clj-a');

    expectLib.expect(sessionRouting.isPinned()).toBe(false);
    expectLib.expect(sessionRouting.getRoutingMode()).toBe('auto');
  });

  it('switching pin between sessions from different clients works', () => {
    sessionRegistry.registerSession('clj-a', createSession('clj', 'client-a'), {});
    sessionRegistry.registerSession('cljs-b', createSession('cljs', 'client-b'), {});

    sessionRouting.pinSession('clj-a');
    expectLib.expect(sessionRouting.resolvePinnedSession()).toBe('clj-a');

    sessionRouting.pinSession('cljs-b');
    expectLib.expect(sessionRouting.resolvePinnedSession()).toBe('cljs-b');
  });
});
