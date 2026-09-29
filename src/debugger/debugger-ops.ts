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

function sessionSupportsOperation(
  session: nrepl.NReplSession | undefined,
  operation: string
): boolean {
  return Boolean(session && typeof session.supports === 'function' && session.supports(operation));
}

export function supportsDebuggerOps(session?: nrepl.NReplSession): boolean {
  return DEBUGGER_OPS.every((op) => sessionSupportsOperation(session, op));
}

export function formatUnsupportedDebuggerMessage(
  sessionKey = 'current',
  session?: nrepl.NReplSession
): string {
  const missingOps = DEBUGGER_OPS.filter((op) => !sessionSupportsOperation(session, op));
  return `The ${sessionKey} nREPL session does not report support for debugger operations (${missingOps.join(
    ', '
  )}). Calva will evaluate requested forms without breakpoint instrumentation for this session.`;
}

export function instrumentSourceCodeWhenSupported(
  code: string,
  session: nrepl.NReplSession | undefined,
  hasBreakpoints: boolean,
  instrument: (source: string) => string
): string {
  return hasBreakpoints && supportsDebuggerOps(session) ? instrument(code) : code;
}

export function isClojureFamilySourcePath(path: string): boolean {
  const extension = path.match(/\.([^./]+)$/)?.[1];
  return Boolean(extension && CLOJURE_FAMILY_SOURCE_EXTENSIONS.includes(extension));
}
