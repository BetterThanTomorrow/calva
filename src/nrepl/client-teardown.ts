/**
 * Client teardown utilities for connection lifecycle management.
 * These utilities are designed to be VS Code-independent for testability
 */

import * as fruitSuffix from './fruit-suffix';
import * as clientRegistry from './client-registry';

/**
 * Tracks clients whose fruit should be preserved during teardown.
 * Used during reconnection: the new connection reserves the fruit before
 * the old client is disconnected, and we mark the old client's fruit as
 * preserved so the on-close handler won't release it.
 */
const preservedFruitClients: Set<string> = new Set();

/**
 * Mark a client's fruit as preserved, preventing releaseClientFruit from
 * releasing it. Used during reconnection to prevent the on-close handler
 * from releasing fruit that will be reused by the new connection.
 *
 * @param clientKey - The client key to preserve fruit for
 */
export function markFruitPreserved(clientKey: string): void {
  if (clientKey) {
    preservedFruitClients.add(clientKey);
  }
}

/**
 * Clear the preserved flag for a client's fruit, allowing subsequent
 * releaseClientFruit calls to release it.
 *
 * @param clientKey - The client key to clear preservation for
 */
export function clearFruitPreserved(clientKey: string): void {
  preservedFruitClients.delete(clientKey);
}

/**
 * Check if a client's fruit is marked as preserved.
 *
 * @param clientKey - The client key to check
 * @returns true if fruit is preserved, false otherwise
 */
export function isFruitPreserved(clientKey: string): boolean {
  return preservedFruitClients.has(clientKey);
}

/**
 * Release the fruit suffix associated with a client's connection state.
 *
 * This should be called whenever a client is being torn down to prevent
 * fruit suffix leaks. Safe to call with undefined/null clientKey or when
 * no fruit suffix exists.
 *
 * If the client's fruit is marked as preserved (via markFruitPreserved),
 * this function will skip releasing the fruit and return undefined.
 *
 * @param clientKey - The client key to release fruit for
 * @returns The released fruit suffix, or undefined if none was released
 */
export function releaseClientFruit(clientKey: string | undefined): string | undefined {
  if (!clientKey) {
    return undefined;
  }

  // Check if fruit is marked as preserved (reconnection scenario)
  if (preservedFruitClients.has(clientKey)) {
    // Clean up the preserved flag but don't release the fruit
    preservedFruitClients.delete(clientKey);
    return undefined;
  }

  const connectionState = clientRegistry.getConnectionState(clientKey);
  if (connectionState?.fruitSuffix) {
    fruitSuffix.releaseFruit(connectionState.fruitSuffix);
    return connectionState.fruitSuffix;
  }

  return undefined;
}

/**
 * Release a fruit suffix directly (when we have the suffix but no client).
 *
 * This handles the case where a connection attempt fails after acquiring
 * a fruit suffix but before the client is registered. In such cases,
 * we need to release the fruit directly.
 *
 * @param fruit - The fruit suffix to release, or undefined
 */
export function releaseFruitDirectly(fruit: string | undefined): void {
  if (fruit) {
    fruitSuffix.releaseFruit(fruit);
  }
}
