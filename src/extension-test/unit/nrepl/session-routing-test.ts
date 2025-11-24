import * as expect from 'expect';
import type { NReplSession } from '../../../../src/nrepl';
import * as sessionRouting from '../../../../src/nrepl/session-routing';
import * as sessionRegistry from '../../../../src/nrepl/session-registry';

const createSession = (replType: string): NReplSession =>
  ({
    replType,
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
    expect(sessionRouting.resolvePreferredSession('clj')).toBe('beta');
  });

  it('routes cljc files using the override when not pinned', () => {
    sessionRegistry.registerSession('alpha', createSession('clj'), {});
    sessionRegistry.registerSession('beta', createSession('cljs'), {});

    sessionRouting.setCljcSessionKey('beta');

    expect(sessionRouting.resolvePreferredSession('cljc')).toBe('beta');
    expect(sessionRouting.resolvePreferredSession('clj')).toBeUndefined();
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

  it('ignores cljc overrides when a session is pinned', () => {
    sessionRegistry.registerSession('alpha', createSession('clj'), {});
    sessionRegistry.registerSession('beta', createSession('cljs'), {});

    sessionRouting.setCljcSessionKey('beta');
    sessionRouting.pinSession('alpha');

    expect(sessionRouting.isPinned()).toBe(true);
    expect(sessionRouting.resolvePreferredSession('cljc')).toBe('alpha');
  });

  it('falls back to auto routing when the pinned session disappears', () => {
    sessionRegistry.registerSession('alpha', createSession('clj'), {});
    sessionRouting.pinSession('alpha');

    sessionRegistry.unregisterSession('alpha');

    expect(sessionRouting.isPinned()).toBe(false);
    expect(sessionRouting.getRoutingMode()).toBe('auto');
  });
});
