/**
 * Session name resolution for automatic conflict handling.
 *
 * Resolves session names at connection time, automatically applying suffixes
 * when conflicts are detected, while preserving names for reconnection scenarios.
 */

import * as clientRegistry from './client-registry';
import * as sessionRegistry from './session-registry';
import * as nameSuffix from './session-name-suffix';
import type * as sessionRoleUtils from './session-role-utils';

export interface SessionNameResolution {
  /** Final session names to use */
  finalNames: sessionRoleUtils.SessionRoleKeys;

  /** Name suffix applied, if any */
  suffix?: string;

  /** Client to disconnect for reconnection, if any */
  reconnectClientKey?: string;
}

/**
 * Check if two SessionRoleKeys have the same base names.
 */
function sameBaseNames(
  a: sessionRoleUtils.SessionRoleKeys,
  b: sessionRoleUtils.SessionRoleKeys
): boolean {
  return a.primary === b.primary && a.secondary === b.secondary;
}

/**
 * Find an existing client that indicates a reconnection scenario.
 *
 * When port is provided: matches base names + host + port (the caller knows
 * specifically which server to reconnect to).
 *
 * When port is null: matches base names + project root (the caller doesn't
 * know the port yet — e.g. jack-in starts a new server on a new port).
 */
function findReconnectionCandidate(
  baseNames: sessionRoleUtils.SessionRoleKeys,
  projectRoot: string,
  host: string,
  port: number | null
): string | undefined {
  const clients = clientRegistry.listClients();
  for (const client of clients) {
    const connState = client.connectionState;

    if (!connState.baseSessionNames || !sameBaseNames(connState.baseSessionNames, baseNames)) {
      continue;
    }

    if (port === null) {
      if (client.projectRoot === projectRoot) {
        return client.key;
      }
    } else {
      if (client.host === host && client.port === port) {
        return client.key;
      }
    }
  }
  return undefined;
}

/**
 * Check if any registered client has matching base session names and project root,
 * regardless of host:port.
 */
export function hasMatchingBaseConnection(
  baseNames: sessionRoleUtils.SessionRoleKeys,
  projectRoot: string
): boolean {
  const clients = clientRegistry.listClients();
  return clients.some(
    (client) =>
      client.connectionState.baseSessionNames &&
      sameBaseNames(client.connectionState.baseSessionNames, baseNames) &&
      client.projectRoot === projectRoot
  );
}

/**
 * Check if any of the requested session keys conflict with existing sessions.
 * A conflict means the session exists and is owned by a different client.
 */
function hasConflict(keys: sessionRoleUtils.SessionRoleKeys): boolean {
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
 * Apply a suffix to both primary and secondary session names.
 */
function applySuffixToNames(
  baseNames: sessionRoleUtils.SessionRoleKeys,
  suffix: string
): sessionRoleUtils.SessionRoleKeys {
  const result: sessionRoleUtils.SessionRoleKeys = {
    primary: nameSuffix.applySuffix(baseNames.primary, suffix),
  };
  if (baseNames.secondary) {
    result.secondary = nameSuffix.applySuffix(baseNames.secondary, suffix);
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
 *    → If conflict, acquire suffix and apply to names
 * 3. Otherwise, use base names as-is
 *
 * @param baseNames - Session names from connect sequence (before any suffix)
 * @param projectRoot - Project root URI string
 * @returns Resolution with final names and any required actions
 * @throws Error if suffix pool is exhausted when suffix is needed
 */
export function resolveSessionNames(
  baseNames: sessionRoleUtils.SessionRoleKeys,
  projectRoot: string,
  host: string,
  port: number | null
): SessionNameResolution {
  const reconnectClientKey = findReconnectionCandidate(baseNames, projectRoot, host, port);
  if (reconnectClientKey) {
    const existingState = clientRegistry.getConnectionState(reconnectClientKey);
    const existingSuffix = existingState?.suffix;
    const finalNames = existingSuffix ? applySuffixToNames(baseNames, existingSuffix) : baseNames;

    if (existingSuffix) {
      nameSuffix.reserveSuffix(existingSuffix);
    }

    return {
      finalNames,
      suffix: existingSuffix,
      reconnectClientKey,
    };
  }

  if (hasConflict(baseNames)) {
    if (nameSuffix.isPoolExhausted()) {
      throw new Error(
        'Cannot connect: too many REPLs with the same session names. ' +
          'Disconnect some REPLs or use custom session names in your connect sequence.'
      );
    }

    const suffix = nameSuffix.acquireNextAvailableSuffix();
    if (!suffix) {
      throw new Error('Cannot connect: failed to acquire name suffix.');
    }

    return {
      finalNames: applySuffixToNames(baseNames, suffix),
      suffix,
    };
  }

  return {
    finalNames: baseNames,
  };
}
