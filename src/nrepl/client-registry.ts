import type { NReplClient } from './index';
import * as sessionRegistry from './session-registry';

export interface RegisteredClient {
  key: string;
  client: NReplClient;
  connectSequenceName?: string;
  projectRoot?: string;
  host?: string;
  port?: number;
  connectedAt: number;
}

let activeClientKey: string | undefined;
const registeredClients = new Map<string, RegisteredClient>();

function selectFallbackActiveClient(): void {
  const fallback = registeredClients.keys().next().value;
  activeClientKey = fallback ?? undefined;
}

export function registerClient(
  client: NReplClient,
  metadata: Omit<RegisteredClient, 'key' | 'client' | 'connectedAt'> = {}
): RegisteredClient {
  const entry: RegisteredClient = {
    key: client.clientKey,
    client,
    connectedAt: Date.now(),
    ...metadata,
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

export function clearAllClients(): void {
  registeredClients.clear();
  activeClientKey = undefined;
}
