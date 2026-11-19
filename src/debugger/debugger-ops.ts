import type * as nrepl from '../nrepl';

const DEBUGGER_OPS = ['init-debugger', 'debug-input'];

function sessionSupportsOperation(
  session: nrepl.NReplSession | undefined,
  operation: string
): boolean {
  return Boolean(session && typeof session.supports === 'function' && session.supports(operation));
}

export function supportsDebuggerOps(session?: nrepl.NReplSession): boolean {
  return DEBUGGER_OPS.every((op) => sessionSupportsOperation(session, op));
}

/** A JVM Clojure session whose nREPL server has cider-nrepl's debugger. */
export function canDebug(session?: nrepl.NReplSession): boolean {
  return session?.replType === 'clj' && supportsDebuggerOps(session);
}

export function formatBreakpointsLeftOutMessage(
  sessionKey: string,
  isClojureScriptSession: boolean
): string {
  const reason = isClojureScriptSession
    ? `cider-nrepl's debugger works in Clojure sessions only, and ${sessionKey} is a ClojureScript session`
    : `the ${sessionKey} session's nREPL server doesn't have cider-nrepl's debugger`;
  return `Calva evaluated the form without its gutter breakpoints: ${reason}.`;
}

export function formatInstrumentUnsupportedMessage(sessionKey: string): string {
  return `Can't instrument the form for debugging: the ${sessionKey} session's nREPL server doesn't have cider-nrepl's debugger. Nothing was evaluated.`;
}
