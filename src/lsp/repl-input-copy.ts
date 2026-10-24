import * as vscode from 'vscode';
import * as vscodeLsp from 'vscode-languageclient/node';

const copySegments = ['.calva', 'repl-input', 'repl_input.clj'];

const copyPathEnd = '/' + copySegments.join('/');

/** True when `uri` is the REPL Input's copy for clojure-lsp, under any project root. */
export function isCopy(uri: vscode.Uri): boolean {
  return uri.path.endsWith(copyPathEnd);
}

function copyUri(client: vscodeLsp.LanguageClient): string | undefined {
  const root = client.clientOptions.workspaceFolder?.uri;
  return root && vscode.Uri.joinPath(root, ...copySegments).toString();
}

type Copy = { uri: string; text: string; position: vscodeLsp.Position };

async function completeInCopy(
  client: vscodeLsp.LanguageClient,
  { uri, text, position }: Copy,
  token: vscode.CancellationToken
): Promise<vscodeLsp.CompletionItem[]> {
  await client.sendNotification(vscodeLsp.DidOpenTextDocumentNotification.type, {
    textDocument: { uri, languageId: 'clojure', version: 1, text },
  });
  try {
    const result = await client.sendRequest(
      vscodeLsp.CompletionRequest.type,
      { textDocument: { uri }, position },
      token
    );
    return Array.isArray(result) ? result : result?.items ?? [];
  } finally {
    await client.sendNotification(vscodeLsp.DidCloseTextDocumentNotification.type, {
      textDocument: { uri },
    });
    await client.sendNotification(vscodeLsp.DidChangeWatchedFilesNotification.type, {
      changes: [{ uri, type: vscodeLsp.FileChangeType.Deleted }],
    });
  }
}

let lastCycle: Promise<unknown> = Promise.resolve();

/**
 * Completes at `position` in a copy with `text`, which clojure-lsp gets as a file under `client`'s
 * root that isn't on disk: opens it, completes, closes it, and tells clojure-lsp it is deleted, so
 * that its definitions leave clojure-lsp's analysis. A cycle waits for the one before it, so one
 * copy is open at a time.
 */
export function complete(
  client: vscodeLsp.LanguageClient,
  text: string,
  position: vscodeLsp.Position,
  token: vscode.CancellationToken
): Promise<vscodeLsp.CompletionItem[]> {
  const uri = copyUri(client);
  if (!uri) {
    return Promise.resolve([]);
  }
  const cycle = lastCycle.then(() =>
    token.isCancellationRequested ? [] : completeInCopy(client, { uri, text, position }, token)
  );
  lastCycle = cycle.catch(() => undefined);
  return cycle;
}
