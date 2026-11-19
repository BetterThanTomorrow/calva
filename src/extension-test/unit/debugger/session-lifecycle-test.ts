import * as expectLib from 'expect';
import { reconcileDebuggerSession } from '../../../../src/debugger/session-lifecycle';

const SYNC_TRUE = 'sync:true';

describe('debugger session lifecycle', () => {
  it('syncs on connect, clears on disconnect, and syncs again on reconnect', () => {
    const supportedSession = { supported: true };
    const calls: string[] = [];
    const handlers = {
      isSupported: (session: { supported: boolean }) => session.supported,
      synchronizeBreakpoints: () => calls.push('sync'),
    };

    let active = reconcileDebuggerSession(undefined, supportedSession, handlers);
    expectLib.expect(calls).toEqual(['sync']);

    active = reconcileDebuggerSession(active, undefined, handlers);
    expectLib.expect(active).toBeUndefined();
    expectLib.expect(calls).toEqual(['sync']);

    active = reconcileDebuggerSession(active, supportedSession, handlers);
    expectLib.expect(active).toBe(supportedSession);
    expectLib.expect(calls).toEqual(['sync', 'sync']);
  });

  it('stops syncing on an unsupported route and restores sync on a supported route', () => {
    const supportedSession = { supported: true };
    const unsupportedSession = { supported: false };
    const calls: string[] = [];
    const handlers = {
      isSupported: (session: { supported: boolean }) => session.supported,
      synchronizeBreakpoints: (session: { supported: boolean }) =>
        calls.push(`sync:${session.supported}`),
    };

    let active = reconcileDebuggerSession(undefined, supportedSession, handlers);
    active = reconcileDebuggerSession(active, unsupportedSession, handlers);
    expectLib.expect(active).toBe(unsupportedSession);
    expectLib.expect(calls).toEqual([SYNC_TRUE]);

    active = reconcileDebuggerSession(active, supportedSession, handlers);
    expectLib.expect(active).toBe(supportedSession);
    expectLib.expect(calls).toEqual([SYNC_TRUE, SYNC_TRUE]);
  });

  it('does not repeat breakpoint synchronization for the same session', () => {
    const session = { supported: true };
    const calls: string[] = [];
    const handlers = {
      isSupported: (value: { supported: boolean }) => value.supported,
      synchronizeBreakpoints: () => calls.push('sync'),
    };

    const active = reconcileDebuggerSession(undefined, session, handlers);
    expectLib.expect(reconcileDebuggerSession(active, session, handlers)).toBe(session);
    expectLib.expect(calls).toEqual(['sync']);
  });
});
