/**
 * Client teardown utilities for connection lifecycle management.
 * These utilities are designed to be VS Code-independent for testability
 */

import * as nameSuffix from './session-name-suffix';
import * as clientRegistry from './client-registry';

/**
 * Tracks clients whose suffix should be preserved during teardown.
 * Used during reconnection: the new connection reserves the suffix before
 * the old client is disconnected, and we mark the old client's suffix as
 * preserved so the on-close handler won't release it.
 */
const preservedSuffixClients: Set<string> = new Set();

/**
 * Mark a client's suffix as preserved, preventing releaseClientSuffix from
 * releasing it. Used during reconnection to prevent the on-close handler
 * from releasing a suffix that will be reused by the new connection.
 *
 * @param clientKey - The client key to preserve suffix for
 */
export function markSuffixPreserved(clientKey: string): void {
  if (clientKey) {
    preservedSuffixClients.add(clientKey);
  }
}

/**
 * Clear the preserved flag for a client's suffix, allowing subsequent
 * releaseClientSuffix calls to release it.
 *
 * @param clientKey - The client key to clear preservation for
 */
export function clearSuffixPreserved(clientKey: string): void {
  preservedSuffixClients.delete(clientKey);
}

/**
 * Check if a client's suffix is marked as preserved.
 *
 * @param clientKey - The client key to check
 * @returns true if suffix is preserved, false otherwise
 */
export function isSuffixPreserved(clientKey: string): boolean {
  return preservedSuffixClients.has(clientKey);
}

/**
 * Release the suffix associated with a client's connection state.
 *
 * This should be called whenever a client is being torn down to prevent
 * suffix leaks. Safe to call with undefined/null clientKey or when
 * no suffix exists.
 *
 * If the client's suffix is marked as preserved (via markSuffixPreserved),
 * this function will skip releasing the suffix and return undefined.
 *
 * @param clientKey - The client key to release suffix for
 * @returns The released suffix, or undefined if none was released
 */
export function releaseClientSuffix(clientKey: string | undefined): string | undefined {
  if (!clientKey) {
    return undefined;
  }

  // Check if suffix is marked as preserved (reconnection scenario)
  if (preservedSuffixClients.has(clientKey)) {
    // Clean up the preserved flag but don't release the suffix
    preservedSuffixClients.delete(clientKey);
    return undefined;
  }

  const connectionState = clientRegistry.getConnectionState(clientKey);
  if (connectionState?.suffix) {
    nameSuffix.releaseSuffix(connectionState.suffix);
    return connectionState.suffix;
  }

  return undefined;
}

/**
 * Release a suffix directly (when we have the suffix but no client).
 *
 * This handles the case where a connection attempt fails after acquiring
 * a suffix but before the client is registered. In such cases,
 * we need to release the suffix directly.
 *
 * @param suffix - The suffix to release, or undefined
 */
export function releaseSuffixDirectly(suffix: string | undefined): void {
  if (suffix) {
    nameSuffix.releaseSuffix(suffix);
  }
}
