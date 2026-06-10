import type * as nrepl from '../nrepl';

export const DEBUGGER_OPS = ['init-debugger', 'debug-input'];

export function supportsDebuggerOps(session?: nrepl.NReplSession): boolean {
  return Boolean(session && DEBUGGER_OPS.every((op) => session.supports(op)));
}

export function unsupportedDebuggerMessage(sessionKey = 'current'): string {
  return `The ${sessionKey} nREPL session does not support debugger operations. Breakpoint UI is still available in VS Code, but Calva will not instrument or evaluate breakpoint forms for this session. Start the REPL with cider-nrepl debugger middleware to use breakpoints.`;
}
