import { NReplSession } from './index';
import { getStateValue, setStateValue } from '../../out/cljs-lib/cljs-lib';

export interface SessionMetadata {
  key: string;
  name?: string;
  projectRoot?: string;
  lastActivity?: number;
  globs?: string[];
}

const SESSION_PREFIX = 'repl-session-';

function getStorageKey(key: string): string {
  return `${SESSION_PREFIX}${key}`;
}

export function registerSession(
  key: string,
  session: NReplSession,
  metadata: Omit<SessionMetadata, 'key' | 'lastActivity'> = {}
): void {
  const fullMetadata: SessionMetadata = {
    key,
    lastActivity: Date.now(),
    ...metadata,
  };

  // Store the session object itself
  setStateValue(getStorageKey(key), session);

  // Store metadata on the session object for easy retrieval
  // We cast to any here because we're dynamically adding properties to the session object
  // which might not be strictly typed in NReplSession
  (session as any)._calvaSessionMetadata = fullMetadata;

  // Maintain a list of registered session keys
  const registeredKeys = getStateValue('registered-session-keys') || [];
  if (!registeredKeys.includes(key)) {
    setStateValue('registered-session-keys', [...registeredKeys, key]);
  }
}

export function getSession(key: string): NReplSession | undefined {
  return getStateValue(getStorageKey(key));
}

export function unregisterSession(key: string): void {
  setStateValue(getStorageKey(key), null);

  const registeredKeys = getStateValue('registered-session-keys') || [];
  const newKeys = registeredKeys.filter((k: string) => k !== key);
  setStateValue('registered-session-keys', newKeys);
}

export function listSessions(): SessionMetadata[] {
  const keys = getStateValue('registered-session-keys') || [];
  return keys
    .map((key: string) => {
      const session = getSession(key);
      return (session as any)?._calvaSessionMetadata;
    })
    .filter((meta: SessionMetadata | undefined) => meta !== undefined);
}

export function getSessionMetadata(key: string): SessionMetadata | undefined {
  const session = getSession(key);
  return (session as any)?._calvaSessionMetadata;
}

export function getSessionKeyFromSession(session?: NReplSession): string | undefined {
  return (session as any)?._calvaSessionMetadata?.key || session?.replType;
}

export function resolveSessionKey(session?: NReplSession, fallback: string = 'clj'): string {
  return getSessionKeyFromSession(session) || session?.replType || fallback;
}

export function updateSessionActivity(key: string): void {
  const session = getSession(key);
  if (session && (session as any)._calvaSessionMetadata) {
    (session as any)._calvaSessionMetadata.lastActivity = Date.now();
  }
}

export function clearAllSessions(): void {
  const keys = getStateValue('registered-session-keys') || [];
  keys.forEach((key: string) => {
    setStateValue(getStorageKey(key), null);
  });
  setStateValue('registered-session-keys', []);
}
