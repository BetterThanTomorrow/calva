import type { NReplClient } from './index';
import * as sessionRegistry from './session-registry';
import type { SessionRoleKeys, SessionGlobMap } from './session-role-utils';
import type { ReplConnectSequence } from './connectSequence';

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

let activeClientKey: string | undefined;
const registeredClients = new Map<string, RegisteredClient>();

function selectFallbackActiveClient(): void {
  const fallback = registeredClients.keys().next().value;
  activeClientKey = fallback ?? undefined;
}

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
  if (!activeClientKey) {
    activeClientKey = entry.key;
  }

  return entry;
}

export function unregisterClient(clientKey: string): RegisteredClient | undefined {
  const entry = registeredClients.get(clientKey);
  if (!entry) {
    return undefined;
  }

  registeredClients.delete(clientKey);
  if (activeClientKey === clientKey) {
    selectFallbackActiveClient();
  }

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

export function setActiveClientKey(clientKey: string | undefined): void {
  if (!clientKey) {
    selectFallbackActiveClient();
    return;
  }

  if (registeredClients.has(clientKey)) {
    activeClientKey = clientKey;
  } else {
    selectFallbackActiveClient();
  }
}

export function getActiveClient(): NReplClient | undefined {
  return activeClientKey ? registeredClients.get(activeClientKey)?.client : undefined;
}

export function getActiveClientKey(): string | undefined {
  return activeClientKey;
}

export function getClientSessions(clientKey: string) {
  return sessionRegistry.listSessionsByClient(clientKey);
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
 * List all connection states.
 * Useful for debugging and testing.
 */
export function listConnectionStates(): (ConnectionState & { clientKey: string })[] {
  return Array.from(registeredClients.values()).map((entry) => ({
    ...entry.connectionState,
    clientKey: entry.key,
  }));
}

export function clearAllClients(): void {
  registeredClients.clear();
  activeClientKey = undefined;
}
