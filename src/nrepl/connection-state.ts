/**
 * Connection State Registry
 *
 * Manages per-connection state for multiple concurrent nREPL connections.
 * Each connection (identified by clientKey) has its own state for things like
 * CLJS build, runtime type, etc.
 *
 * This replaces global state that was previously overwritten when connecting
 * additional sequences.
 */

export interface ConnectionState {
  clientKey: string;
  cljsBuild: string | null;
  cljsTypeName: string | null;
  hasBuilds: boolean;
}

const connectionStates = new Map<string, ConnectionState>();

/**
 * Get the connection state for a given client key.
 */
export function getConnectionState(clientKey: string): ConnectionState | undefined {
  return connectionStates.get(clientKey);
}

/**
 * Set or update connection state for a given client key.
 * Merges with existing state if present.
 */
export function setConnectionState(clientKey: string, state: Partial<ConnectionState>): void {
  const existing = connectionStates.get(clientKey);
  const newState: ConnectionState = {
    clientKey,
    cljsBuild: null,
    cljsTypeName: null,
    hasBuilds: false,
    ...existing,
    ...state,
  };
  connectionStates.set(clientKey, newState);
}

/**
 * Clear connection state for a given client key.
 * Called when a connection is disconnected.
 */
export function clearConnectionState(clientKey: string): void {
  connectionStates.delete(clientKey);
}

/**
 * Clear all connection states.
 * Called during full disconnect or testing.
 */
export function clearAllConnectionStates(): void {
  connectionStates.clear();
}

/**
 * List all connection states.
 * Useful for debugging and testing.
 */
export function listConnectionStates(): ConnectionState[] {
  return Array.from(connectionStates.values());
}
