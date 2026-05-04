import type * as globs from './globs';
import type * as nrepl from './index';
import * as clientRegistry from './client-registry';
import * as sessionNameSuffix from './session-name-suffix';

export interface SessionMetadata {
  key: string;
  projectRoot?: string;
  globs?: string[];
  globSpecs?: globs.SessionGlobSpec[];
  connectionOwnerId?: string;
  isSecondary?: boolean;
  lastActivity?: number;
}

const registeredSessions = new Map<string, nrepl.NReplSession>();

export function registerSession(
  key: string,
  session: nrepl.NReplSession,
  metadata: Omit<SessionMetadata, 'key'> = {}
): void {
  const computedOwnerId = metadata.connectionOwnerId ?? session?.client?.clientKey;
  const fullMetadata: SessionMetadata = {
    key,
    ...metadata,
    connectionOwnerId: computedOwnerId,
  };

  registeredSessions.set(key, session);

  (session as any)._calvaSessionMetadata = fullMetadata;
}

export function getSession(key: string): nrepl.NReplSession | undefined {
  return registeredSessions.get(key);
}

export function unregisterSession(key: string): void {
  registeredSessions.delete(key);
}

export function listSessions(): SessionMetadata[] {
  return Array.from(registeredSessions.values())
    .map((session) => (session as any)?._calvaSessionMetadata as SessionMetadata | undefined)
    .filter((meta): meta is SessionMetadata => meta !== undefined);
}

export function getSessionMetadata(key: string): SessionMetadata | undefined {
  const session = getSession(key);
  return (session as any)?._calvaSessionMetadata;
}

export function updateSessionActivity(sessionOrkey: string | nrepl.NReplSession): void {
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

export function resolveSessionKey(session?: nrepl.NReplSession, fallback: string = 'clj'): string {
  return (session as any)?._calvaSessionMetadata?.key ?? fallback;
}

/**
 * Test utility: direct access to internal sessions map for test cleanup.
 * Production code should use registerSession/unregisterSession.
 */
export const _testUtility_registeredSessions = registeredSessions;

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
export function findPrimarySessionForConnection(
  sessionKey: string
): nrepl.NReplSession | undefined {
  const metadata = getSessionMetadata(sessionKey);
  if (!metadata?.connectionOwnerId) {
    return undefined;
  }

  const siblingMetas = listSessionsByClient(metadata.connectionOwnerId);
  const primaryMeta = siblingMetas.find((m) => !m.isSecondary);
  return primaryMeta ? getSession(primaryMeta.key) : undefined;
}

/**
 * Extended connection state that includes client info.
 * Used by code that needs both connection state AND client-level info.
 */
export interface ConnectionContext extends clientRegistry.ConnectionState {
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
export function getPrimarySessionForClient(clientKey: string): nrepl.NReplSession | undefined {
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

// --- Session renaming ---

/**
 * Rename a registered session from oldKey to newKey.
 * Updates the registry, metadata, connection state, routing, and suffix pool.
 * Returns true on success, false if oldKey is not found or newKey already exists.
 */
export function renameSession(oldKey: string, newKey: string): boolean {
  const session = registeredSessions.get(oldKey);
  if (!session || registeredSessions.has(newKey)) {
    return false;
  }

  // Re-key the registry
  registeredSessions.delete(oldKey);
  registeredSessions.set(newKey, session);

  // Update metadata
  const metadata = (session as any)._calvaSessionMetadata as SessionMetadata | undefined;
  if (metadata) {
    metadata.key = newKey;
  }

  // Update ConnectionState.sessionRoleKeys
  const clientKey = metadata?.connectionOwnerId;
  if (clientKey) {
    const connState = clientRegistry.getConnectionState(clientKey);
    if (connState?.sessionRoleKeys) {
      const roleKeys = { ...connState.sessionRoleKeys };
      if (roleKeys.primary === oldKey) {
        roleKeys.primary = newKey;
      }
      if (roleKeys.secondary === oldKey) {
        roleKeys.secondary = newKey;
      }
      clientRegistry.setConnectionState(clientKey, { sessionRoleKeys: roleKeys });
    }
  }

  // Release suffix if old name had one
  const suffix = sessionNameSuffix.extractSuffix(oldKey);
  if (suffix) {
    sessionNameSuffix.releaseSuffix(suffix);
  }

  return true;
}

// --- ClojureDocs dedicated session ---

let clojureDocsSessionKey: string | null = null;

/**
 * Set the session key to use for ClojureDocs lookups.
 * Pass null to clear the dedicated session.
 */
export function setClojureDocsSessionKey(key: string | null): void {
  clojureDocsSessionKey = key;
}

/**
 * Get the session key currently designated for ClojureDocs lookups.
 */
export function getClojureDocsSessionKey(): string | null {
  return clojureDocsSessionKey;
}

/**
 * Get the session currently designated for ClojureDocs lookups.
 */
export function getClojureDocsSession(): nrepl.NReplSession | undefined {
  const key = getClojureDocsSessionKey();
  return key ? getSession(key) : undefined;
}
