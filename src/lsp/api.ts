import { LanguageClient } from 'vscode-languageclient/node';
import * as defs from './definitions';
import * as path from 'node:path';
import * as vscode from 'vscode';

export const FALLBACK_CLIENT_ID = '__FALLBACK_LSP_CLIENT__';

export const isFallbackClient = (client: defs.LspClient) => {
  return client.id === FALLBACK_CLIENT_ID;
};

export const clientIsAlive = (client: defs.LspClient) => {
  return [defs.LspStatus.Starting, defs.LspStatus.Running].includes(client.status);
};

/**
 * Checks if a given path is the root of the filesystem in a platform agnostic manner (this should
 * work identically on POSIX and Windows)
 */
const isRoot = (dir: string) => {
  const normalized = path.normalize(dir);
  return path.dirname(normalized) === normalized;
};

/**
 * Find the closest, active clojure-lsp client to a given URI. This works by traversing up the path component of the
 * provided URI until a client at the same level is found. This works because clients in the LspClientStore use their
 * root path as the their address in the Map.
 *
 * If no client is found then we try return the shared fallback lsp client if it has been provisioned. This client uses
 * a special key `__FALLBACK_LSP_CLIENT__` and so would never be returned for normal path traversal search but instead
 * must be explicitly referenced.
 */
export const getActiveClientForUri = (clients: defs.LspClientStore, uri: vscode.Uri) => {
  let current = uri.fsPath;
  while (!isRoot(current)) {
    const client = clients.get(current);
    if (client && clientIsAlive(client)) {
      return client;
    }
    current = path.join(current, '..');
  }
  if (lastActiveClient && clientIsAlive(lastActiveClient)) {
    return lastActiveClient;
  }
  const fallback_client = clients.get(FALLBACK_CLIENT_ID);
  if (fallback_client && clientIsAlive(fallback_client)) {
    return fallback_client;
  }
};

// Temporary hack to pick the last active client when no active client matches the current file Uri
// Such as when serving jar files
// TODO: Figure out the proper way to handle this
let lastActiveClient: defs.LspClient | undefined;

/**
 * Similar to `getActiveClientForUri` except this only returns the client if it is in a running state. This API
 * should be used by systems wanting to interact with the LSP client.
 */
export const getClientForDocumentUri = (clients: defs.LspClientStore, uri: vscode.Uri) => {
  const client = getActiveClientForUri(clients, uri);
  if (client && client.status === defs.LspStatus.Running) {
    lastActiveClient = client;
    return client.client;
  } else {
    return lastActiveClient?.client;
  }
};

export type ServerInfo = {
  'cljfmt-raw': string;
  'clj-kondo-version': string;
  'server-version': string;
  'semantic-tokens': string[];
};

export const getServerInfo = async (client: LanguageClient) => {
  try {
    return await client.sendRequest<ServerInfo>('clojure/serverInfo/raw');
  } catch (err) {
    console.error('LSP request "clojure/serverInfo/raw: failed', err);
  }
};

type GetClojureDocsParams = {
  symName: string;
  symNs: string;
};
export const getClojureDocs = async (client: LanguageClient, params: GetClojureDocsParams) => {
  const server_info = await getServerInfo(client);
  if (server_info['server-version'] <= '2021.10.20-16.49.47') {
    return;
  }

  return client.sendRequest('clojure/clojuredocs/raw', {
    symName: params.symName,
    symNs: params.symNs,
  });
};

export async function getCljFmtConfig(client: LanguageClient) {
  const server_info = await getServerInfo(client);
  return server_info?.['cljfmt-raw'];
}

export async function getSemanticTokens(client: LanguageClient) {
  const server_info = await getServerInfo(client);
  return server_info?.['semantic-tokens'];
}

export function getReferences(
  client: LanguageClient,
  documentUri: vscode.Uri,
  position: vscode.Position | defs.Position,
  includeDeclaration = true
) {
  return client.sendRequest<Location[] | null>('textDocument/references', {
    textDocument: {
      uri: documentUri.toString(),
    },
    position,
    context: {
      includeDeclaration,
    },
  });
}

export function getDocumentSymbols(lspClient: LanguageClient, documentUri: vscode.Uri) {
  return lspClient.sendRequest<vscode.DocumentSymbol[]>('textDocument/documentSymbol', {
    textDocument: {
      uri: documentUri.toString(),
    },
  });
}

export function getCursorInfo(
  client: LanguageClient,
  textDocument: vscode.TextDocument,
  position: vscode.Position
) {
  return client.sendRequest<any>('clojure/cursorInfo/raw', {
    textDocument: { uri: textDocument.uri.toString() },
    position: { line: position.line, character: position.character },
  });
}
