import * as expectLib from 'expect';
import { reconcileDebuggerSession } from '../../../../src/debugger/session-lifecycle';

describe('debugger session lifecycle', () => {
  it('initializes and syncs on connect, clears on disconnect, and restores on reconnect', () => {
    const supportedSession = { supported: true };
    const calls: string[] = [];
    const handlers = {
      isSupported: (session: { supported: boolean }) => session.supported,
      initialize: () => calls.push('initialize'),
      synchronizeBreakpoints: () => calls.push('sync'),
    };

    let active = reconcileDebuggerSession(undefined, supportedSession, handlers);
    expectLib.expect(calls).toEqual(['initialize', 'sync']);

    active = reconcileDebuggerSession(active, undefined, handlers);
    expectLib.expect(active).toBeUndefined();
    expectLib.expect(calls).toEqual(['initialize', 'sync']);

    active = reconcileDebuggerSession(active, supportedSession, handlers);
    expectLib.expect(active).toBe(supportedSession);
    expectLib.expect(calls).toEqual(['initialize', 'sync', 'initialize', 'sync']);
  });

  it('stops syncing on an unsupported route and restores sync on a supported route', () => {
    const supportedSession = { supported: true };
    const unsupportedSession = { supported: false };
    const calls: string[] = [];
    const handlers = {
      isSupported: (session: { supported: boolean }) => session.supported,
      initialize: (session: { supported: boolean }) =>
        calls.push(`initialize:${session.supported}`),
      synchronizeBreakpoints: (session: { supported: boolean }) =>
        calls.push(`sync:${session.supported}`),
    };

    let active = reconcileDebuggerSession(undefined, supportedSession, handlers);
    active = reconcileDebuggerSession(active, unsupportedSession, handlers);
    expectLib.expect(active).toBe(unsupportedSession);
    expectLib.expect(calls).toEqual(['initialize:true', 'sync:true']);

    active = reconcileDebuggerSession(active, supportedSession, handlers);
    expectLib.expect(active).toBe(supportedSession);
    expectLib
      .expect(calls)
      .toEqual(['initialize:true', 'sync:true', 'initialize:true', 'sync:true']);
  });

  it('does not repeat initialization or breakpoint synchronization for the same session', () => {
    const session = { supported: true };
    const calls: string[] = [];
    const handlers = {
      isSupported: (value: { supported: boolean }) => value.supported,
      initialize: () => calls.push('initialize'),
      synchronizeBreakpoints: () => calls.push('sync'),
    };

    const active = reconcileDebuggerSession(undefined, session, handlers);
    expectLib.expect(reconcileDebuggerSession(active, session, handlers)).toBe(session);
    expectLib.expect(calls).toEqual(['initialize', 'sync']);
  });
});
