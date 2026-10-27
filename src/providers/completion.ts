import * as vscode from 'vscode';
import * as util from '../utilities';
import * as docMirror from '../doc-mirror/index';
import * as infoparser from './infoparser';
import * as namespace from '../namespace';
import * as replSession from '../nrepl/repl-session';
import type { NReplSession } from '../nrepl';
import * as vscodeLanguageserverProtocol from 'vscode-languageserver-protocol';
import * as protocolConverter from 'vscode-languageclient/lib/common/protocolConverter';
import * as lsp from '../lsp';
import * as completionUtil from './completion-util';
import * as replCompletion from './repl-completion';

const converter = protocolConverter.createConverter(undefined, undefined, true);

const completionProviderOptions = { priority: ['lsp', 'repl'], merge: true };

const completionFunctions = { lsp: lspCompletions, repl: replCompletions };

async function provideCompletions(provider: string) {
  return await completionFunctions[provider]().catch((err) => {
    console.log(`Failed to get results from completions provider '${provider}'`, err);
  });
}

async function provideCompletionItems(
  clientProvider: lsp.ClientProvider,
  document: vscode.TextDocument,
  position: vscode.Position,
  token: vscode.CancellationToken,
  context: vscode.CompletionContext
) {
  let results = [];
  for (const provider of completionProviderOptions.priority) {
    if (results.length && !completionProviderOptions.merge) {
      break;
    }

    const completions = await completionFunctions[provider](
      clientProvider,
      document,
      position,
      token,
      context
    ).catch((err) => {
      console.log(`Failed to get results from completions provider '${provider}'`, err);
    });
    if (completions) {
      results = completionUtil.mergeCompletions(results, completions);
    }
  }

  const completionItems = results.map((completion) => converter.asCompletionItem(completion));

  return new vscode.CompletionList(completionItems, true);
}

export class CalvaCompletionItemProvider implements vscode.CompletionItemProvider {
  constructor(private readonly clientProvider: lsp.ClientProvider) {}

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ) {
    return provideCompletionItems(this.clientProvider, document, position, token, context);
  }

  async resolveCompletionItem(item: vscode.CompletionItem, token: vscode.CancellationToken) {
    if (util.getConnectedState() && item['data']?.provider === 'repl') {
      const activeTextEditor = vscode.window.activeTextEditor;

      util.assertIsDefined(activeTextEditor, 'Expected window to have activeTextEditor defined!');

      const client = replSession.getSession();
      if (client) {
        await namespace.createNamespaceFromDocumentIfNotExists(activeTextEditor.document);
        const [ns, _] = namespace.getDocumentNamespace();
        await resolveReplCompletionItem(client, ns, item);
      }

      return item;
    } else {
      const res = await lspResolveCompletions(
        this.clientProvider,
        vscode.window.activeTextEditor.document.uri,
        item,
        token
      );

      return converter.asCompletionItem(res);
    }
  }
}

function lspCompletions(
  clientProvider: lsp.ClientProvider,
  document: vscode.TextDocument,
  position: vscode.Position,
  token: vscode.CancellationToken,
  context: vscode.CompletionContext
) {
  const client = clientProvider.getClientForDocumentUri(document.uri);
  if (client) {
    return client.sendRequest(
      vscodeLanguageserverProtocol.CompletionRequest.type,
      client.code2ProtocolConverter.asCompletionParams(document, position, context),
      token
    );
  } else {
    return Promise.resolve([]);
  }
}

async function lspResolveCompletions(
  clientProvider: lsp.ClientProvider,
  uri: vscode.Uri,
  item: vscode.CompletionItem,
  token: vscode.CancellationToken
) {
  const client = clientProvider.getClientForDocumentUri(uri);
  return await client?.sendRequest(
    vscodeLanguageserverProtocol.CompletionResolveRequest.type,
    client.code2ProtocolConverter.asCompletionItem(item),
    token
  );
}

/**
 * Fills in the documentation and detail of a REPL completion item, from `session`'s info
 * on the item in namespace `ns`.
 */
export async function resolveReplCompletionItem(
  session: NReplSession,
  ns: string,
  item: vscode.CompletionItem
) {
  const result = await session.info(
    ns,
    typeof item.label === 'string' ? item.label : item['data'].label
  );
  const [doc, details] = infoparser.getCompletion(result);
  const docFromCider = item['data']?.['completion-doc'];

  item.documentation =
    doc || docFromCider ? new vscode.MarkdownString(docFromCider, true) : undefined;
  item.detail = details;
  return item;
}

async function replCompletions(
  clientProvider: lsp.ClientProvider,
  document: vscode.TextDocument,
  position: vscode.Position,
  _token: vscode.CancellationToken,
  _context: vscode.CompletionContext
): Promise<vscodeLanguageserverProtocol.CompletionItem[]> {
  if (!util.getConnectedState()) {
    return [];
  }
  const [ns, _] = namespace.getNamespace(document, position);
  return replCompletion.replCompletions(
    replSession.getSession(document),
    ns,
    docMirror.getDocument(document),
    document.offsetAt(position)
  );
}
