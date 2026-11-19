export interface DebuggerSessionLifecycleHandlers<T> {
  isSupported(session: T): boolean;
  synchronizeBreakpoints(session: T): void;
}

/** Reconcile debugger state only when the active routed session changes. */
export function reconcileDebuggerSession<T>(
  previousSession: T | undefined,
  nextSession: T | undefined,
  handlers: DebuggerSessionLifecycleHandlers<T>
): T | undefined {
  if (previousSession === nextSession) {
    return previousSession;
  }

  if (nextSession && handlers.isSupported(nextSession)) {
    handlers.synchronizeBreakpoints(nextSession);
  }

  return nextSession;
}
