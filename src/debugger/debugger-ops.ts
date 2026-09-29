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
export function supportsDebuggerOps(session?: nrepl.NReplSession): boolean {
  return Boolean(session && DEBUGGER_OPS.every((op) => session.supports(op)));
}

export function formatUnsupportedDebuggerMessage(
  sessionKey = 'current',
  session?: nrepl.NReplSession
): string {
  const missingOps = DEBUGGER_OPS.filter((op) => !session?.supports(op));
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
