import * as expectLib from 'expect';
import type * as nrepl from '../../../../src/nrepl';
import {
  isClojureFamilySourcePath,
  instrumentSourceCodeWhenSupported,
  supportsDebuggerOps,
  formatUnsupportedDebuggerMessage,
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

  it('formats unsupported debugger messages with the session key and required operations', () => {
    expectLib
      .expect(formatUnsupportedDebuggerMessage('my-clj'))
      .toContain('The my-clj nREPL session does not report support for debugger operations');
    expectLib
      .expect(formatUnsupportedDebuggerMessage())
      .toContain('The current nREPL session does not report support for debugger operations');
    expectLib
      .expect(formatUnsupportedDebuggerMessage())
      .toContain(`${INIT_DEBUGGER}, ${DEBUG_INPUT}`);
    expectLib.expect(formatUnsupportedDebuggerMessage()).not.toContain('JVM');
    expectLib.expect(formatUnsupportedDebuggerMessage()).toContain('evaluate requested forms');
    expectLib
      .expect(formatUnsupportedDebuggerMessage('partial', createSession(['init-debugger'])))
      .toContain(`(${DEBUG_INPUT})`);
    expectLib
      .expect(formatUnsupportedDebuggerMessage('legacy', { replType: 'clj' } as nrepl.NReplSession))
      .toContain(`(${INIT_DEBUGGER}, ${DEBUG_INPUT})`);
  });

  it('recognizes Clojure-family source paths including ClojureScript', () => {
    expectLib.expect(isClojureFamilySourcePath('/project/src/main/core.clj')).toBe(true);
    expectLib.expect(isClojureFamilySourcePath('/project/src/main/core.cljs')).toBe(true);
    expectLib.expect(isClojureFamilySourcePath('/project/src/main/core.cljc')).toBe(true);
    expectLib.expect(isClojureFamilySourcePath('/project/deps.edn')).toBe(false);
    expectLib.expect(isClojureFamilySourcePath('/project/src/main/core.js')).toBe(false);
  });

  it('recognizes dialect sources without excluding them by extension', () => {
    for (const path of ['core.clj', 'core.cljs', 'core.cljc', 'core.cljd', 'core.cljr']) {
      expectLib.expect(isClojureFamilySourcePath(`/project/src/main/${path}`)).toBe(true);
    }
  });

  it('keeps breakpoint evaluation source unchanged when debugger ops are unavailable', () => {
    const source = '(println :ordinary-evaluation)';
    let instrumentCalled = false;
    const result = instrumentSourceCodeWhenSupported(
      source,
      createSession([INIT_DEBUGGER]),
      true,
      (code) => {
        instrumentCalled = true;
        return `#break ${code}`;
      }
    );

    expectLib.expect(result).toBe(source);
    expectLib.expect(instrumentCalled).toBe(false);
  });
});
