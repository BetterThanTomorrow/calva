import { NReplSession } from './index';
import * as cljsLib from '../../out/cljs-lib/cljs-lib';
import type { SessionGlobSpec, SessionGlobTier } from './globs';

export interface SessionMetadata {
  key: string;
  projectRoot?: string;
  lastActivity?: number;
  globs?: string[];
  globSpecs?: SessionGlobSpec[];
  connectionOwnerId?: string;
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
