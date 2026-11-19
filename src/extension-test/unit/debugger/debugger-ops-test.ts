import * as expectLib from 'expect';
import type * as nrepl from '../../../../src/nrepl';
import {
  canDebug,
  formatBreakpointsLeftOutMessage,
  supportsDebuggerOps,
  formatInstrumentUnsupportedMessage,
} from '../../../../src/debugger/debugger-ops';

const DEBUG_INPUT = 'debug-input';
const INIT_DEBUGGER = 'init-debugger';

function createSession(supportedOps: string[]): nrepl.NReplSession {
  return {
    supports: (op: string) => supportedOps.includes(op),
  } as nrepl.NReplSession;
}

describe('debugger ops', () => {
  it('requires both debugger middleware operations', () => {
    expectLib.expect(supportsDebuggerOps(createSession([INIT_DEBUGGER, DEBUG_INPUT]))).toBe(true);
    expectLib.expect(supportsDebuggerOps(createSession([INIT_DEBUGGER]))).toBe(false);
    expectLib.expect(supportsDebuggerOps(createSession([DEBUG_INPUT]))).toBe(false);
    expectLib.expect(supportsDebuggerOps(undefined)).toBe(false);
    expectLib.expect(supportsDebuggerOps({ replType: 'clj' } as nrepl.NReplSession)).toBe(false);
  });

  it('does not require the optional debug decoration operation', () => {
    expectLib.expect(supportsDebuggerOps(createSession([INIT_DEBUGGER, DEBUG_INPUT]))).toBe(true);
  });

  it('can debug only in a clj session that has both debugger operations', () => {
    const withOps = (replType: 'clj' | 'cljs') =>
      ({ ...createSession([INIT_DEBUGGER, DEBUG_INPUT]), replType } as nrepl.NReplSession);
    expectLib.expect(canDebug(withOps('clj'))).toBe(true);
    expectLib.expect(canDebug(withOps('cljs'))).toBe(false);
    expectLib
      .expect(
        canDebug({ ...createSession([INIT_DEBUGGER]), replType: 'clj' } as nrepl.NReplSession)
      )
      .toBe(false);
    expectLib.expect(canDebug(undefined)).toBe(false);
  });

  it('says why Calva left out the gutter breakpoints', () => {
    expectLib
      .expect(formatBreakpointsLeftOutMessage('bb', false))
      .toBe(
        "Calva evaluated the form without its gutter breakpoints: the bb session's nREPL server doesn't have cider-nrepl's debugger."
      );
    expectLib
      .expect(formatBreakpointsLeftOutMessage('cljs', true))
      .toBe(
        "Calva evaluated the form without its gutter breakpoints: cider-nrepl's debugger works in Clojure sessions only, and cljs is a ClojureScript session."
      );
  });

  it('says that instrumenting needs cider-nrepl and that nothing was evaluated', () => {
    expectLib
      .expect(formatInstrumentUnsupportedMessage('bb'))
      .toBe(
        "Can't instrument the form for debugging: the bb session's nREPL server doesn't have cider-nrepl's debugger. Nothing was evaluated."
      );
  });
});
