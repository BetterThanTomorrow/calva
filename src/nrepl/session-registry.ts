import { NReplSession } from './index';
import * as cljsLib from '../../out/cljs-lib/cljs-lib';
import type { SessionGlobSpec, SessionGlobTier } from './globs';
import * as clientRegistry from './client-registry';
import type { ConnectionState } from './client-registry';

export interface SessionMetadata {
  key: string;
  projectRoot?: string;
  lastActivity?: number;
  globs?: string[];
  globSpecs?: SessionGlobSpec[];
  connectionOwnerId?: string;
  isSecondary?: boolean;
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
  const computedOwnerId = metadata.connectionOwnerId ?? session?.client?.clientKey;
  const fullMetadata: SessionMetadata = {
    key,
    lastActivity: Date.now(),
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

export function updateSessionActivity(key: string): void {
  const session = getSession(key);
  if (session && (session as any)._calvaSessionMetadata) {
    (session as any)._calvaSessionMetadata.lastActivity = Date.now();
  }
}

export function clearAllSessions(): void {
  const keys = cljsLib.getStateValue('registered-session-keys') || [];
  keys.forEach((key: string) => {
    cljsLib.setStateValue(getStorageKey(key), null);
  });
  cljsLib.setStateValue('registered-session-keys', []);
}

export type SessionKeyOccupancy = 'available' | 'same-client' | 'conflict';

export interface SessionKeyStatus {
  key: string;
  occupancy: SessionKeyOccupancy;
  metadata?: SessionMetadata;
}

export type SessionAssignmentSummary = 'available' | 'existing-client' | 'conflict';

export interface SessionAssignmentAnalysis {
  summary: SessionAssignmentSummary;
  statuses: SessionKeyStatus[];
}

export function analyzeSessionAssignments(
  requestedKeys: Array<string | undefined>,
  clientKey?: string
): SessionAssignmentAnalysis {
  const uniqueKeys = Array.from(new Set(requestedKeys.filter(Boolean)));
  const statuses: SessionKeyStatus[] = uniqueKeys.map((key) => {
    const metadata = getSessionMetadata(key);
    if (!metadata) {
      return { key, occupancy: 'available' };
    }

    if (metadata.connectionOwnerId && clientKey && metadata.connectionOwnerId === clientKey) {
      return { key, occupancy: 'same-client', metadata };
    }

    return { key, occupancy: 'conflict', metadata };
  });

  let summary: SessionAssignmentSummary = 'available';
  if (statuses.some((status) => status.occupancy === 'conflict')) {
    summary = 'conflict';
  } else if (statuses.some((status) => status.occupancy === 'same-client')) {
    summary = 'existing-client';
  }

  return { summary, statuses };
}

export function listSessionsByClient(targetClientKey: string): SessionMetadata[] {
  if (!targetClientKey) {
    return [];
  }
  return listSessions().filter((meta) => meta.connectionOwnerId === targetClientKey);
}

/**
 * Checks if all the requested session keys are either available or owned by a single client.
 * This is used to determine if a reconnection scenario is valid - where we can disconnect
 * the existing client and replace its sessions with new ones.
 *
 * Returns the clientKey that owns all the occupied sessions, or undefined if:
 * - All sessions are available (no existing owner)
 * - Sessions are owned by multiple different clients (true conflict)
 */
export function findSingleOwnerForSessions(
  requestedKeys: Array<string | undefined>
): string | undefined {
  const uniqueKeys = Array.from(new Set(requestedKeys.filter(Boolean)));
  const ownerIds = new Set<string>();

  for (const key of uniqueKeys) {
    const metadata = getSessionMetadata(key);
    if (metadata?.connectionOwnerId) {
      ownerIds.add(metadata.connectionOwnerId);
    }
  }

  // If all sessions have a single owner, return that owner's clientKey
  if (ownerIds.size === 1) {
    return Array.from(ownerIds)[0];
  }

  // Multiple owners or no owners
  return undefined;
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
 * Find the secondary session for the same connection as the given session.
 */
export function findSecondarySessionForConnection(sessionKey: string): NReplSession | undefined {
  const metadata = getSessionMetadata(sessionKey);
  if (!metadata?.connectionOwnerId) {
    return undefined;
  }

  const siblingMetas = listSessionsByClient(metadata.connectionOwnerId);
  const secondaryMeta = siblingMetas.find((m) => m.isSecondary);
  return secondaryMeta ? getSession(secondaryMeta.key) : undefined;
}

/**
 * Find the secondary session key for the same connection as the given session.
 */
export function findSecondarySessionKeyForConnection(sessionKey: string): string | undefined {
  const metadata = getSessionMetadata(sessionKey);
  if (!metadata?.connectionOwnerId) {
    return undefined;
  }

  const siblingMetas = listSessionsByClient(metadata.connectionOwnerId);
  const secondaryMeta = siblingMetas.find((m) => m.isSecondary);
  return secondaryMeta?.key;
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
 * Get the secondary session for a given client.
 */
export function getSecondarySessionForClient(clientKey: string): NReplSession | undefined {
  const sessions = listSessionsByClient(clientKey);
  const secondaryMeta = sessions.find((m) => m.isSecondary);
  if (!secondaryMeta) {
    return undefined;
  }
  return getSession(secondaryMeta.key);
}

/**
 * Get the secondary session key for a given client.
 */
export function getSecondarySessionKeyForClient(clientKey: string): string | undefined {
  const sessions = listSessionsByClient(clientKey);
  const secondaryMeta = sessions.find((m) => m.isSecondary);
  return secondaryMeta?.key;
}
