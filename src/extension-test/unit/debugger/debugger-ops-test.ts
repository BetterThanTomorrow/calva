import * as expectLib from 'expect';
import type * as nrepl from '../../../../src/nrepl';
import {
  UNSUPPORTED_RUNTIME_BREAKPOINT_MESSAGE,
  isClojureFamilySourcePath,
  isUnsupportedBreakpointRuntimeSourcePath,
  supportsDebuggerOps,
  formatUnsupportedDebuggerMessage,
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
      .expect(formatUnsupportedDebuggerMessage('my-clj'))
      .toContain('The my-clj nREPL session does not report support for debugger operations');
    expectLib
      .expect(formatUnsupportedDebuggerMessage())
      .toContain('The current nREPL session does not report support for debugger operations');
    expectLib.expect(formatUnsupportedDebuggerMessage()).toContain('JVM Clojure REPL sessions');
  });

  it('formats unsupported runtime breakpoint messages', () => {
    expectLib
      .expect(UNSUPPORTED_RUNTIME_BREAKPOINT_MESSAGE)
      .toContain('supported only for JVM Clojure REPL sessions');
    expectLib.expect(UNSUPPORTED_RUNTIME_BREAKPOINT_MESSAGE).toContain('Clojure-family runtime');
  });

  it('recognizes Clojure-family source paths including ClojureScript', () => {
    expectLib.expect(isClojureFamilySourcePath('/project/src/main/core.clj')).toBe(true);
    expectLib.expect(isClojureFamilySourcePath('/project/src/main/core.cljs')).toBe(true);
    expectLib.expect(isClojureFamilySourcePath('/project/src/main/core.cljc')).toBe(true);
    expectLib.expect(isClojureFamilySourcePath('/project/deps.edn')).toBe(false);
    expectLib.expect(isClojureFamilySourcePath('/project/src/main/core.js')).toBe(false);
  });

  it('recognizes source paths for unsupported breakpoint runtimes', () => {
    expectLib
      .expect(isUnsupportedBreakpointRuntimeSourcePath('/project/src/main/core.cljs'))
      .toBe(true);
    expectLib
      .expect(isUnsupportedBreakpointRuntimeSourcePath('/project/src/main/core.cljd'))
      .toBe(true);
    expectLib
      .expect(isUnsupportedBreakpointRuntimeSourcePath('/project/src/main/core.cljr'))
      .toBe(true);
    expectLib
      .expect(isUnsupportedBreakpointRuntimeSourcePath('/project/src/main/core.cljc'))
      .toBe(false);
    expectLib
      .expect(isUnsupportedBreakpointRuntimeSourcePath('/project/src/main/core.clj'))
      .toBe(false);
  });
});
