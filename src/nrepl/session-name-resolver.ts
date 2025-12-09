/**
 * Session name resolution for automatic conflict handling.
 *
 * Resolves session names at connection time, automatically applying fruit suffixes
 * when conflicts are detected, while preserving names for reconnection scenarios.
 */

import type { SessionRoleKeys } from './session-role-utils';
import * as clientRegistry from './client-registry';
import * as sessionRegistry from './session-registry';
import * as fruitSuffix from './fruit-suffix';

export interface SessionNameResolution {
  /** Final session names to use */
  finalNames: SessionRoleKeys;

  /** Fruit suffix applied, if any */
  fruitSuffix?: string;

  /** Client to disconnect for reconnection, if any */
  reconnectClientKey?: string;
}

/**
 * Check if two SessionRoleKeys have the same base names.
 */
function sameBaseNames(a: SessionRoleKeys, b: SessionRoleKeys): boolean {
  return a.primary === b.primary && a.secondary === b.secondary;
}

/**
 * Find an existing client that has the same base session names and project root.
 * This indicates a reconnection scenario.
 */
function findReconnectionCandidate(
  baseNames: SessionRoleKeys,
  projectRoot: string
): string | undefined {
  const clients = clientRegistry.listClients();
  for (const client of clients) {
    const connState = client.connectionState;
    const clientProjectRoot = client.projectRoot;

    // Check if this client has matching baseSessionNames and projectRoot
    if (
      connState.baseSessionNames &&
      sameBaseNames(connState.baseSessionNames, baseNames) &&
      clientProjectRoot === projectRoot
    ) {
      return client.key;
    }
  }
  return undefined;
}

/**
 * Check if any of the requested session keys conflict with existing sessions.
 * A conflict means the session exists and is owned by a different client.
 */
function hasConflict(keys: SessionRoleKeys): boolean {
  const keysToCheck = [keys.primary];
  if (keys.secondary) {
    keysToCheck.push(keys.secondary);
  }

  for (const key of keysToCheck) {
    const metadata = sessionRegistry.getSessionMetadata(key);
    if (metadata) {
      return true;
    }
  }
  return false;
}

/**
 * Apply a fruit suffix to both primary and secondary session names.
 */
function applyFruitToNames(baseNames: SessionRoleKeys, fruit: string): SessionRoleKeys {
  const result: SessionRoleKeys = {
    primary: fruitSuffix.applyFruitSuffix(baseNames.primary, fruit),
  };
  if (baseNames.secondary) {
    result.secondary = fruitSuffix.applyFruitSuffix(baseNames.secondary, fruit);
  }
  return result;
}

/**
 * Resolve session names for a new connection.
 *
 * Resolution logic:
 * 1. Check for reconnection scenario (same baseNames + projectRoot)
 *    → Return existing final names, mark client for disconnect
 * 2. Check for conflicts with base names
 *    → If conflict, acquire fruit suffix and apply to names
 * 3. Otherwise, use base names as-is
 *
 * @param baseNames - Session names from connect sequence (before any suffix)
 * @param projectRoot - Project root URI string
 * @returns Resolution with final names and any required actions
 * @throws Error if fruit pool is exhausted when suffix is needed
 */
export function resolveSessionNames(
  baseNames: SessionRoleKeys,
  projectRoot: string
): SessionNameResolution {
  const reconnectClientKey = findReconnectionCandidate(baseNames, projectRoot);
  if (reconnectClientKey) {
    const existingState = clientRegistry.getConnectionState(reconnectClientKey);
    const existingFruit = existingState?.fruitSuffix;
    const finalNames = existingFruit ? applyFruitToNames(baseNames, existingFruit) : baseNames;

    if (existingFruit) {
      fruitSuffix.reserveFruit(existingFruit);
    }

    return {
      finalNames,
      fruitSuffix: existingFruit,
      reconnectClientKey,
    };
  }

  if (hasConflict(baseNames)) {
    if (fruitSuffix.isPoolExhausted()) {
      throw new Error(
        'Cannot connect: too many REPLs with the same session names. ' +
          'Disconnect some REPLs or use custom session names in your connect sequence.'
      );
    }

    const fruit = fruitSuffix.acquireNextAvailableFruit();
    if (!fruit) {
      throw new Error('Cannot connect: failed to acquire fruit suffix.');
    }

    return {
      finalNames: applyFruitToNames(baseNames, fruit),
      fruitSuffix: fruit,
    };
  }

  return {
    finalNames: baseNames,
  };
}
