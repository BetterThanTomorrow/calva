import type * as nrepl from '../nrepl';

export const DEBUGGER_OPS = ['init-debugger', 'debug-input'];
export const CLOJURE_FAMILY_SOURCE_EXTENSIONS = [
  'clj',
  'cljs',
  'cljc',
  'cljd',
  'cljr',
  'cljx',
  'clojure',
];
export const UNSUPPORTED_BREAKPOINT_SOURCE_EXTENSIONS = ['cljs', 'cljd', 'cljr'];
export const UNSUPPORTED_RUNTIME_BREAKPOINT_MESSAGE =
  'Calva breakpoints are supported only for JVM Clojure REPL sessions. The current Clojure-family runtime can show VS Code breakpoint markers, but Calva will not instrument or evaluate breakpoint forms for it.';

export function supportsDebuggerOps(session?: nrepl.NReplSession): boolean {
  return Boolean(session && DEBUGGER_OPS.every((op) => session.supports(op)));
}

export function formatUnsupportedDebuggerMessage(sessionKey = 'current'): string {
  return `The ${sessionKey} nREPL session does not report support for debugger operations (${DEBUGGER_OPS.join(
    ', '
  )}). Calva breakpoints are supported only for JVM Clojure REPL sessions that provide those operations, so Calva will not instrument or evaluate breakpoint forms for this session.`;
}

export function formatUnsupportedRuntimeBreakpointMessage(): string {
  return UNSUPPORTED_RUNTIME_BREAKPOINT_MESSAGE;
}

export function isClojureFamilySourcePath(path: string): boolean {
  const extension = path.match(/\.([^.\/]+)$/)?.[1];
  return Boolean(extension && CLOJURE_FAMILY_SOURCE_EXTENSIONS.includes(extension));
}

export function isUnsupportedBreakpointRuntimeSourcePath(path: string): boolean {
  const extension = path.match(/\.([^.\/]+)$/)?.[1];
  return Boolean(extension && UNSUPPORTED_BREAKPOINT_SOURCE_EXTENSIONS.includes(extension));
}
