import * as expectLib from 'expect';
import type * as nrepl from '../../../../src/nrepl';
import {
  supportsDebuggerOps,
  unsupportedDebuggerMessage,
} from '../../../../src/debugger/debugger-ops';

function createSession(supportedOps: string[]): nrepl.NReplSession {
  return {
    supports: (op: string) => supportedOps.includes(op),
  } as nrepl.NReplSession;
}

describe('debugger ops', () => {
  it('requires both debugger middleware operations', () => {
    expectLib
      .expect(supportsDebuggerOps(createSession(['init-debugger', 'debug-input'])))
      .toBe(true);
    expectLib.expect(supportsDebuggerOps(createSession(['init-debugger']))).toBe(false);
    expectLib.expect(supportsDebuggerOps(createSession(['debug-input']))).toBe(false);
    expectLib.expect(supportsDebuggerOps(undefined)).toBe(false);
  });

  it('formats unsupported debugger messages with the session key', () => {
    expectLib
      .expect(unsupportedDebuggerMessage('my-clj'))
      .toContain('The my-clj nREPL session does not support debugger operations.');
    expectLib
      .expect(unsupportedDebuggerMessage())
      .toContain('The current nREPL session does not support debugger operations.');
  });
});
