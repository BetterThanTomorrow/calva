export type SessionsChangedEventType =
  | 'session-added'
  | 'session-removed'
  | 'session-renamed'
  | 'runtime-connected'
  | 'runtime-disconnected'
  | 'connection-added'
  | 'connection-removed';

export interface ShadowRuntimeInfo {
  runtimeId: number;
  description: string;
  buildId: string;
  host: string;
  workerId: number;
  sinceInst: number;
  sinceDescription: string;
  lastActivity?: number;
}

export interface SessionsChangedEvent {
  type: SessionsChangedEventType;
  clientKey?: string;
  sessionKey?: string;
  previousSessionKey?: string;
  runtime?: ShadowRuntimeInfo;
}

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
