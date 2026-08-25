import type {
  SessionsChangedEvent,
  SessionsChangedEventType,
  ShadowRuntimeInfo,
} from '../api/repl-v1';

export type { SessionsChangedEvent, SessionsChangedEventType, ShadowRuntimeInfo };

export interface Disposable {
  dispose(): void;
}

export type SessionsChangedListener = (event: SessionsChangedEvent) => void;

const listeners = new Set<SessionsChangedListener>();

export function onSessionsChanged(listener: SessionsChangedListener): Disposable {
  listeners.add(listener);
  return {
    dispose: () => {
      listeners.delete(listener);
    },
  };
}

export function fireSessionsChanged(event: SessionsChangedEvent): void {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (e) {
      console.error('Error in onSessionsChanged listener:', e);
    }
  });
}

/**
 * Test utility: reset all listeners.
 */
export function _testUtility_resetSessionEvents(): void {
  listeners.clear();
}
