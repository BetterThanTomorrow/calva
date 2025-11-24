import { getStateValue, setStateValue } from '../../out/cljs-lib/cljs-lib';
import * as sessionRegistry from './session-registry';

export type SessionRoutingMode = 'auto' | 'pinned';

const ROUTING_MODE_STATE_KEY = 'session-routing-mode';
const PINNED_SESSION_STATE_KEY = 'session-routing-pinned-session-key';
const CLJC_SESSION_STATE_KEY = 'session-routing-cljc-session-key';

function selectFallbackSessionKey(): string | undefined {
  const sessions = sessionRegistry.listSessions();
  return sessions[0]?.key;
}

function readStoredKey(stateKey: string): string | undefined {
  const value = getStateValue(stateKey);
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function clearStateKey(stateKey: string): void {
  setStateValue(stateKey, null);
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
  const stored = getStateValue(ROUTING_MODE_STATE_KEY);
  return stored === 'pinned' ? 'pinned' : 'auto';
}

function setRoutingMode(mode: SessionRoutingMode): void {
  setStateValue(ROUTING_MODE_STATE_KEY, mode);
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

  setStateValue(PINNED_SESSION_STATE_KEY, sessionKey);
  setRoutingMode('pinned');
}

export function enableAutoRouting(): void {
  clearStateKey(PINNED_SESSION_STATE_KEY);
  setRoutingMode('auto');
}

export function clearPinnedSession(): void {
  clearStateKey(PINNED_SESSION_STATE_KEY);
  setRoutingMode('auto');
}

export function isPinned(): boolean {
  return getRoutingMode() === 'pinned' && Boolean(getPinnedSessionKey());
}

function ensureCljcSessionKey(): string | undefined {
  const activeKey = ensureActiveSession(readStoredKey(CLJC_SESSION_STATE_KEY));
  if (activeKey) {
    return activeKey;
  }

  const fallback = selectFallbackSessionKey();
  if (fallback) {
    setStateValue(CLJC_SESSION_STATE_KEY, fallback);
    return fallback;
  }

  clearStateKey(CLJC_SESSION_STATE_KEY);
  return undefined;
}

export function getCljcSessionKey(): string | undefined {
  return ensureCljcSessionKey();
}

export function setCljcSessionKey(sessionKey?: string): void {
  if (!sessionKey || !ensureActiveSession(sessionKey)) {
    const fallback = selectFallbackSessionKey();
    if (fallback) {
      setStateValue(CLJC_SESSION_STATE_KEY, fallback);
    } else {
      clearStateKey(CLJC_SESSION_STATE_KEY);
    }
    return;
  }

  setStateValue(CLJC_SESSION_STATE_KEY, sessionKey);
}

export function clearCljcSessionKey(): void {
  clearStateKey(CLJC_SESSION_STATE_KEY);
}

export function hasCljcOverride(): boolean {
  return Boolean(getCljcSessionKey());
}

export function resolvePreferredSession(fileType?: string): string | undefined {
  const pinnedKey = getPinnedSessionKey();
  if (getRoutingMode() === 'pinned' && pinnedKey) {
    return pinnedKey;
  }

  if (fileType === 'cljc') {
    return getCljcSessionKey();
  }

  return undefined;
}

export function resetRouting(): void {
  enableAutoRouting();
  clearStateKey(CLJC_SESSION_STATE_KEY);
}

export function removeSessionKeyFromRouting(sessionKey: string): void {
  if (!sessionKey) {
    return;
  }

  const pinnedKey = readStoredKey(PINNED_SESSION_STATE_KEY);
  if (pinnedKey === sessionKey) {
    clearPinnedSession();
  }

  const cljcKey = readStoredKey(CLJC_SESSION_STATE_KEY);
  if (cljcKey === sessionKey) {
    clearCljcSessionKey();
  }
}

export function removeSessionKeysFromRouting(sessionKeys: string[]): void {
  sessionKeys.forEach((key) => removeSessionKeyFromRouting(key));
}
