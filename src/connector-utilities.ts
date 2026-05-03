/**
 * Types for disconnect selection results.
 */
export interface DisconnectSelectionAll {
  kind: 'all';
}

export interface DisconnectSelectionSingle {
  kind: 'single';
  clientKey: string;
}

export interface DisconnectSelectionWsServer {
  kind: 'ws-server';
  wsServer: import('./nrepl/nrepl-ws-server').NReplWsServer;
}

export type DisconnectSelection =
  | DisconnectSelectionAll
  | DisconnectSelectionSingle
  | DisconnectSelectionWsServer;

/**
 * Information about a client for display in disconnect picker.
 * Separates the pure data from VS Code QuickPickItem.
 */
export interface ClientDisplayInfo {
  key: string;
  connectSequenceName?: string;
  projectRoot?: string;
  host?: string;
  port?: number;
  sessionKeys: string[];
}

/**
 * Builds the label for a disconnect picker item.
 * Uses connectSequenceName if available, otherwise falls back to client key.
 */
export function buildDisconnectItemLabel(client: ClientDisplayInfo): string {
  return client.connectSequenceName || client.key;
}

/**
 * Builds the description for a disconnect picker item.
 * Combines session summary and project root.
 */
export function buildDisconnectItemDescription(
  sessionKeys: string[],
  relativeProjectRoot?: string
): string {
  const sessionSummary = sessionKeys.length > 0 ? sessionKeys.join(', ') : 'No sessions registered';

  const parts: string[] = [sessionSummary];
  if (relativeProjectRoot) {
    parts.push(relativeProjectRoot);
  }
  return parts.join(' — ');
}

/**
 * Builds the detail line for a disconnect picker item.
 * Shows host:port if available.
 */
export function buildDisconnectItemDetail(host?: string, port?: number): string | undefined {
  if (!host) {
    return undefined;
  }
  return port ? `${host}:${port}` : host;
}
