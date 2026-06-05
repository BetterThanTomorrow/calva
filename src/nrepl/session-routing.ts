import * as cljsLib from '../../out/cljs-lib/cljs-lib';
import * as sessionRegistry from './session-registry';

export type SessionRoutingMode = 'auto' | 'pinned';

const ROUTING_MODE_STATE_KEY = 'session-routing-mode';
const PINNED_SESSION_STATE_KEY = 'session-routing-pinned-session-key';
const routingChangeListeners = new Set<() => void>();

export function onDidChangeRouting(listener: () => void): { dispose(): void } {
  routingChangeListeners.add(listener);
  return {
    dispose() {
      routingChangeListeners.delete(listener);
    },
  };
}

function fireRoutingChange(): void {
  routingChangeListeners.forEach((listener) => listener());
}

function readStoredKey(stateKey: string): string | undefined {
  const value = cljsLib.getStateValue(stateKey);
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function clearStateKey(stateKey: string): void {
  cljsLib.setStateValue(stateKey, null);
}

function ensureActiveSession(key: string | undefined): string | undefined {
  if (!key) {
    return undefined;
  }

  if (sessionRegistry.getSession(key)) {
    return key;
  }

  return undefined;
}

export function getRoutingMode(): SessionRoutingMode {
  const stored = cljsLib.getStateValue(ROUTING_MODE_STATE_KEY);
  return stored === 'pinned' ? 'pinned' : 'auto';
}

function setRoutingMode(mode: SessionRoutingMode): void {
  cljsLib.setStateValue(ROUTING_MODE_STATE_KEY, mode);
}

export function getPinnedSessionKey(): string | undefined {
  const activeKey = ensureActiveSession(readStoredKey(PINNED_SESSION_STATE_KEY));
  if (!activeKey) {
    clearStateKey(PINNED_SESSION_STATE_KEY);
    if (getRoutingMode() === 'pinned') {
      setRoutingMode('auto');
    }
    return undefined;
  }
  return activeKey;
}

export function pinSession(sessionKey: string | undefined): void {
  if (!sessionKey || !ensureActiveSession(sessionKey)) {
    enableAutoRouting();
    return;
  }

  cljsLib.setStateValue(PINNED_SESSION_STATE_KEY, sessionKey);
  setRoutingMode('pinned');
  fireRoutingChange();
}

export function enableAutoRouting(): void {
  clearStateKey(PINNED_SESSION_STATE_KEY);
  setRoutingMode('auto');
  fireRoutingChange();
}

export function isPinned(): boolean {
  return getRoutingMode() === 'pinned' && Boolean(getPinnedSessionKey());
}

/**
 * Returns the pinned session key if routing mode is 'pinned'.
 * Returns undefined for auto-routing mode (let caller handle glob matching and fallbacks).
 */
export function resolvePinnedSession(): string | undefined {
  const pinnedKey = getPinnedSessionKey();
  if (getRoutingMode() === 'pinned' && pinnedKey) {
    return pinnedKey;
  }

  return undefined;
}

export function resetRouting(): void {
  enableAutoRouting();
}

export function removeSessionKeyFromRouting(sessionKey: string): void {
  if (!sessionKey) {
    return;
  }

  const pinnedKey = readStoredKey(PINNED_SESSION_STATE_KEY);
  if (pinnedKey === sessionKey) {
    enableAutoRouting();
  }
}

export function removeSessionKeysFromRouting(sessionKeys: string[]): void {
  sessionKeys.forEach((key) => removeSessionKeyFromRouting(key));
}
