import type { NReplClient } from './index';
import type { SessionRoleKeys, SessionGlobMap } from './session-role-utils';
import type { ReplConnectSequence } from './connectSequence';

export type CljcTargetRole = 'primary' | 'secondary';

/**
 * Connection state for CLJS-specific information.
 * Previously in a separate connection-state.ts module, now unified with client registry.
 */
export interface ConnectionState {
  cljsBuild: string | null;
  cljsTypeName: string | null;
  hasBuilds: boolean;
  sessionRoleKeys?: SessionRoleKeys;
  sessionGlobMap?: SessionGlobMap;
  connectSequence?: ReplConnectSequence;
  shadowCljsRuntimeId?: number;
  shadowCljsRuntimeInfo?: any;
  /** Base session names before any fruit suffix was applied */
  baseSessionNames?: SessionRoleKeys;
  /** The fruit suffix applied to this connection, if any */
  fruitSuffix?: string;
  /** Which session role should handle .cljc files for this connection */
  cljcTarget?: CljcTargetRole;
}

export interface RegisteredClient {
  key: string;
  client: NReplClient;
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
  client: NReplClient,
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

  return entry;
}

export function unregisterClient(clientKey: string): RegisteredClient | undefined {
  const entry = registeredClients.get(clientKey);
  if (!entry) {
    return undefined;
  }

  registeredClients.delete(clientKey);

  return entry;
}

export function listClients(): RegisteredClient[] {
  return Array.from(registeredClients.values()).sort((a, b) => a.connectedAt - b.connectedAt);
}

export function getClient(clientKey: string): NReplClient | undefined {
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

export function clearAllClients(): void {
  registeredClients.clear();
}

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
