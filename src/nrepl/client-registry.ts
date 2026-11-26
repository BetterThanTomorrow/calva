import type * as connectSequence from './connectSequence';
import type * as nrepl from './index';
import type * as sessionRoleUtils from './session-role-utils';
import * as sessionEvents from './session-events';

export type CljcTargetRole = 'primary' | 'secondary';

/**
 * Connection state for CLJS-specific information.
 * Previously in a separate connection-state.ts module, now unified with client registry.
 */
export interface ConnectionState {
  cljsBuild: string | null;
  cljsTypeName: string | null;
  hasBuilds: boolean;
  availableBuilds?: string[];
  sessionRoleKeys?: sessionRoleUtils.SessionRoleKeys;
  sessionGlobMap?: sessionRoleUtils.SessionGlobMap;
  connectSequence?: connectSequence.ReplConnectSequence;
  shadowCljsRuntimeId?: number;
  shadowCljsRuntimeInfo?: any;
  /** Base session names before any suffix was applied */
  baseSessionNames?: sessionRoleUtils.SessionRoleKeys;
  /** The suffix applied to this connection, if any */
  suffix?: string;
  /** Which session role should handle .cljc files for this connection */
  cljcTarget?: CljcTargetRole;
  /** User-assigned custom names per role, preserved across reconnection */
  renamedSessionNames?: Partial<sessionRoleUtils.SessionRoleKeys>;
}

export interface RegisteredClient {
  key: string;
  client: nrepl.NReplClient;
  connectSequenceName?: string;
  projectRoot?: string;
  host?: string;
  port?: number;
  connectedAt: number;
  connectionState: ConnectionState;
}

const registeredClients = new Map<string, RegisteredClient>();

const defaultConnectionState: ConnectionState = {
  cljsBuild: null,
  cljsTypeName: null,
  hasBuilds: false,
};

export function registerClient(
  client: nrepl.NReplClient,
  metadata: Omit<RegisteredClient, 'key' | 'client' | 'connectedAt' | 'connectionState'> & {
    connectionState?: Partial<ConnectionState>;
  } = {}
): RegisteredClient {
  const { connectionState: partialConnState, ...rest } = metadata;
  const entry: RegisteredClient = {
    key: client.clientKey,
    client,
    connectedAt: Date.now(),
    connectionState: { ...defaultConnectionState, ...partialConnState },
    ...rest,
  };

  registeredClients.set(entry.key, entry);

  sessionEvents.fireSessionsChanged({
    type: 'connection-added',
    clientKey: entry.key,
  });

  return entry;
}

export function unregisterClient(clientKey: string): RegisteredClient | undefined {
  const entry = registeredClients.get(clientKey);
  if (!entry) {
    return undefined;
  }

  registeredClients.delete(clientKey);

  sessionEvents.fireSessionsChanged({
    type: 'connection-removed',
    clientKey,
  });

  return entry;
}

export function listClients(): RegisteredClient[] {
  return Array.from(registeredClients.values()).sort((a, b) => a.connectedAt - b.connectedAt);
}

export function getClient(clientKey: string): nrepl.NReplClient | undefined {
  return registeredClients.get(clientKey)?.client;
}

export function getRegisteredClient(clientKey: string): RegisteredClient | undefined {
  return registeredClients.get(clientKey);
}

/**
 * Get the connection state for a given client key.
 */
export function getConnectionState(clientKey: string): ConnectionState | undefined {
  return registeredClients.get(clientKey)?.connectionState;
}

/**
 * Update connection state for a given client key.
 * Merges with existing connection state.
 */
export function setConnectionState(clientKey: string, state: Partial<ConnectionState>): void {
  const entry = registeredClients.get(clientKey);
  if (entry) {
    entry.connectionState = { ...entry.connectionState, ...state };
  }
}

/**
 * Test utility: direct access to internal clients map for test cleanup.
 * Production code should use registerClient/unregisterClient.
 */
export const _testUtility_registeredClients = registeredClients;

/**
 * Get the cljc target role for a connection.
 * Returns 'primary' as the default if not explicitly set.
 */
export function getCljcTargetForConnection(clientKey: string): CljcTargetRole {
  return registeredClients.get(clientKey)?.connectionState.cljcTarget ?? 'primary';
}

/**
 * Set the cljc target role for a connection.
 */
export function setCljcTargetForConnection(clientKey: string, target: CljcTargetRole): void {
  const entry = registeredClients.get(clientKey);
  if (entry) {
    entry.connectionState.cljcTarget = target;
  }
}
