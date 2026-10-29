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

type CopyRequest<T> = (uri: string) => Promise<T>;

async function requestInCopy<T>(
  client: vscodeLsp.LanguageClient,
  uri: string,
  text: string,
  request: CopyRequest<T>
): Promise<T> {
  await client.sendNotification(vscodeLsp.DidOpenTextDocumentNotification.type, {
    textDocument: { uri, languageId: 'clojure', version: 1, text },
  });
  try {
    return await request(uri);
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

type Copy = { text: string; token: vscode.CancellationToken };

/**
 * Sends `request` about a copy with `text`, which clojure-lsp gets as a file under `client`'s root
 * that isn't on disk: opens it, sends the request, closes it, and tells clojure-lsp it is deleted, so
 * that its definitions leave clojure-lsp's analysis. A cycle waits for the one before it, so one copy
 * is open at a time. Returns `none` without a root, or when `token` is cancelled before the cycle.
 */
function inCopy<T>(
  client: vscodeLsp.LanguageClient,
  { text, token }: Copy,
  request: CopyRequest<T>,
  none: T
): Promise<T> {
  const uri = copyUri(client);
  if (!uri) {
    return Promise.resolve(none);
  }
  const cycle = lastCycle.then(() =>
    token.isCancellationRequested ? none : requestInCopy(client, uri, text, request)
  );
  lastCycle = cycle.catch(() => undefined);
  return cycle;
}

/** Completes at `position` in a copy with `text`. */
export function complete(
  client: vscodeLsp.LanguageClient,
  text: string,
  position: vscodeLsp.Position,
  token: vscode.CancellationToken
): Promise<vscodeLsp.CompletionItem[]> {
  return inCopy(
    client,
    { text, token },
    async (uri) => {
      const result = await client.sendRequest(
        vscodeLsp.CompletionRequest.type,
        { textDocument: { uri }, position },
        token
      );
      return Array.isArray(result) ? result : result?.items ?? [];
    },
    []
  );
}

/** A definition clojure-lsp reports: its uri, its zero-based line and character, and whether it is in the copy. */
export type CopyDefinition = { uri: string; line: number; character: number; inCopy: boolean };

function firstDefinition(
  result: vscodeLsp.Definition | vscodeLsp.LocationLink[] | null,
  copy: string
): CopyDefinition | undefined {
  const first = Array.isArray(result) ? result[0] : result;
  if (!first) {
    return undefined;
  }
  const [uri, range] =
    'targetUri' in first ? [first.targetUri, first.targetSelectionRange] : [first.uri, first.range];
  return { uri, line: range.start.line, character: range.start.character, inCopy: uri === copy };
}

/** Finds the definition at `position` in a copy with `text`. */
export function definition(
  client: vscodeLsp.LanguageClient,
  text: string,
  position: vscodeLsp.Position,
  token: vscode.CancellationToken
): Promise<CopyDefinition | undefined> {
  return inCopy(
    client,
    { text, token },
    async (uri) =>
      firstDefinition(
        await client.sendRequest(
          vscodeLsp.DefinitionRequest.type,
          { textDocument: { uri }, position },
          token
        ),
        uri
      ),
    undefined
  );
}
