import { NReplSession } from './index';
import * as cljsLib from '../../out/cljs-lib/cljs-lib';
import type { SessionGlobSpec, SessionGlobTier } from './globs';
import * as clientRegistry from './client-registry';
import type { ConnectionState } from './client-registry';

export interface SessionMetadata {
  key: string;
  projectRoot?: string;
  globs?: string[];
  globSpecs?: SessionGlobSpec[];
  connectionOwnerId?: string;
  isSecondary?: boolean;
  lastActivity?: number;
}

const SESSION_PREFIX = 'repl-session-';

function getStorageKey(key: string): string {
  return `${SESSION_PREFIX}${key}`;
}

export function registerSession(
  key: string,
  session: NReplSession,
  metadata: Omit<SessionMetadata, 'key'> = {}
): void {
  const computedOwnerId = metadata.connectionOwnerId ?? session?.client?.clientKey;
  const fullMetadata: SessionMetadata = {
    key,
    ...metadata,
    connectionOwnerId: computedOwnerId,
  };

  // Store the session object itself
  cljsLib.setStateValue(getStorageKey(key), session);

  // Store metadata on the session object for easy retrieval
  // We cast to any here because we're dynamically adding properties to the session object
  // which might not be strictly typed in NReplSession
  (session as any)._calvaSessionMetadata = fullMetadata;

  // Maintain a list of registered session keys
  const registeredKeys = cljsLib.getStateValue('registered-session-keys') || [];
  if (!registeredKeys.includes(key)) {
    cljsLib.setStateValue('registered-session-keys', [...registeredKeys, key]);
  }
}

export function getSession(key: string): NReplSession | undefined {
  return cljsLib.getStateValue(getStorageKey(key));
}

export function unregisterSession(key: string): void {
  cljsLib.setStateValue(getStorageKey(key), null);

  const registeredKeys = cljsLib.getStateValue('registered-session-keys') || [];
  const newKeys = registeredKeys.filter((k: string) => k !== key);
  cljsLib.setStateValue('registered-session-keys', newKeys);
}

export function listSessions(): SessionMetadata[] {
  const keys = cljsLib.getStateValue('registered-session-keys') || [];
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

export function updateSessionActivity(sessionOrkey: string | NReplSession): void {
  const session = typeof sessionOrkey === 'string' ? getSession(sessionOrkey) : sessionOrkey;
  if (session) {
    const metadata = (session as any)?._calvaSessionMetadata;
    if (metadata) {
      metadata.lastActivity = Date.now();
    }
  }
}

export function isSessionSecondary(key: string): boolean {
  const metadata = getSessionMetadata(key);
  return Boolean(metadata?.isSecondary);
}

export function getSessionKeyFromSession(session?: NReplSession): string | undefined {
  return (session as any)?._calvaSessionMetadata?.key || session?.replType;
}

export function resolveSessionKey(session?: NReplSession, fallback: string = 'clj'): string {
  return getSessionKeyFromSession(session) || session?.replType || fallback;
}

export function clearAllSessions(): void {
  const keys = cljsLib.getStateValue('registered-session-keys') || [];
  keys.forEach((key: string) => {
    cljsLib.setStateValue(getStorageKey(key), null);
  });
  cljsLib.setStateValue('registered-session-keys', []);
}

export function listSessionsByClient(targetClientKey: string): SessionMetadata[] {
  if (!targetClientKey) {
    return [];
  }
  return listSessions().filter((meta) => meta.connectionOwnerId === targetClientKey);
}

/**
 * Find the primary (non-secondary) session for the same connection as the given session.
 * Used when we need to evaluate CLJ code for a feature related to a CLJS session.
 */
export function findPrimarySessionForConnection(sessionKey: string): NReplSession | undefined {
  const metadata = getSessionMetadata(sessionKey);
  if (!metadata?.connectionOwnerId) {
    return undefined;
  }

  const siblingMetas = listSessionsByClient(metadata.connectionOwnerId);
  const primaryMeta = siblingMetas.find((m) => !m.isSecondary);
  return primaryMeta ? getSession(primaryMeta.key) : undefined;
}

/**
 * Find the primary session key for the same connection as the given session.
 */
export function findPrimarySessionKeyForConnection(sessionKey: string): string | undefined {
  const metadata = getSessionMetadata(sessionKey);
  if (!metadata?.connectionOwnerId) {
    return undefined;
  }

  const siblingMetas = listSessionsByClient(metadata.connectionOwnerId);
  const primaryMeta = siblingMetas.find((m) => !m.isSecondary);
  return primaryMeta?.key;
}

/**
 * Extended connection state that includes client info.
 * Used by code that needs both connection state AND client-level info.
 */
export interface ConnectionContext extends ConnectionState {
  clientKey: string;
  projectRoot?: string;
}

/**
 * Get connection state for the connection that owns the given session.
 * This is the primary way to access per-connection state (cljsBuild, cljsTypeName, etc.)
 * from code that knows a session key.
 *
 * Returns a ConnectionContext that includes clientKey and projectRoot for convenience.
 */
export function getConnectionStateForSession(sessionKey: string): ConnectionContext | undefined {
  const metadata = getSessionMetadata(sessionKey);
  if (!metadata?.connectionOwnerId) {
    return undefined;
  }
  const clientKey = metadata.connectionOwnerId;
  const connectionState = clientRegistry.getConnectionState(clientKey);
  if (!connectionState) {
    return undefined;
  }
  const registeredClient = clientRegistry.getRegisteredClient(clientKey);
  return {
    ...connectionState,
    clientKey,
    projectRoot: registeredClient?.projectRoot,
  };
}

/**
 * Get the client key (connection owner ID) for a given session.
 */
export function getClientKeyForSession(sessionKey: string): string | undefined {
  const metadata = getSessionMetadata(sessionKey);
  return metadata?.connectionOwnerId;
}

/**
 * Get the primary (non-secondary) session for a given client.
 */
export function getPrimarySessionForClient(clientKey: string): NReplSession | undefined {
  const sessions = listSessionsByClient(clientKey);
  const primaryMeta = sessions.find((m) => !m.isSecondary);
  if (!primaryMeta) {
    return undefined;
  }
  return getSession(primaryMeta.key);
}

/**
 * Get the primary (non-secondary) session key for a given client.
 */
export function getPrimarySessionKeyForClient(clientKey: string): string | undefined {
  const sessions = listSessionsByClient(clientKey);
  const primaryMeta = sessions.find((m) => !m.isSecondary);
  return primaryMeta?.key;
}

/**
 * Get the secondary session key for a given client.
 */
export function getSecondarySessionKeyForClient(clientKey: string): string | undefined {
  const sessions = listSessionsByClient(clientKey);
  const secondaryMeta = sessions.find((m) => m.isSecondary);
  return secondaryMeta?.key;
}

// --- ClojureDocs dedicated session ---

const CLOJUREDOCS_SESSION_KEY = 'clojuredocs-session-key';

/**
 * Set the session key to use for ClojureDocs lookups.
 * Pass null to clear the dedicated session.
 */
export function setClojureDocsSessionKey(key: string | null): void {
  cljsLib.setStateValue(CLOJUREDOCS_SESSION_KEY, key);
}

/**
 * Get the session key currently designated for ClojureDocs lookups.
 */
export function getClojureDocsSessionKey(): string | null {
  return cljsLib.getStateValue(CLOJUREDOCS_SESSION_KEY) ?? null;
}

/**
 * Get the session currently designated for ClojureDocs lookups.
 */
export function getClojureDocsSession(): NReplSession | undefined {
  const key = getClojureDocsSessionKey();
  return key ? getSession(key) : undefined;
}
