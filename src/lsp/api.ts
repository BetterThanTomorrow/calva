import { LanguageClient } from 'vscode-languageclient/node';
import * as vscode_lsp from 'vscode-languageclient/node';
import * as defs from './definitions';
import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Find the closest provisioned LSP client to a given document URI. This works by traversing up the given URI
 * path until a client at the same directory level is found.
 */
export const getClientForDocumentUri = (
  clients: defs.LSPClientMap,
  uri: vscode.Uri
): vscode_lsp.LanguageClient | undefined => {
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  if (!folder) {
    return;
  }

  let current = uri.path;
  while (current !== '/') {
    const client = clients.get(current);
    if (client?.state === vscode_lsp.State.Running) {
      return client;
    }
    current = path.join(current, '..');
  }
};

export type ServerInfo = {
  'cljfmt-raw': string;
  'clj-kondo-version': string;
  'server-version': string;
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
