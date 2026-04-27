import * as vscode from 'vscode';
import * as util from '../utilities';
import * as select from '../select';
import * as docMirror from '../doc-mirror/index';
import * as infoparser from './infoparser';
import * as namespace from '../namespace';
import * as replSession from '../nrepl/repl-session';
import * as vscodeLanguageserverProtocol from 'vscode-languageserver-protocol';
import * as protocolConverter from 'vscode-languageclient/lib/common/protocolConverter';
import * as lsp from '../lsp';
import * as completionUtil from './completion-util';

const mappings = {
  nil: vscode.CompletionItemKind.Value,
  macro: vscode.CompletionItemKind.Value,
  class: vscode.CompletionItemKind.Class,
  keyword: vscode.CompletionItemKind.Keyword,
  namespace: vscode.CompletionItemKind.Module,
  function: vscode.CompletionItemKind.Function,
  'special-form': vscode.CompletionItemKind.Keyword,
  var: vscode.CompletionItemKind.Variable,
  local: vscode.CompletionItemKind.Variable,
  method: vscode.CompletionItemKind.Method,
};

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
        const result = await client.info(
          ns,
          typeof item.label === 'string' ? item.label : item['data'].label
        );
        const [doc, details] = infoparser.getCompletion(result);
        const docFromCider = item['data']?.['completion-doc'];

        item.documentation =
          doc || docFromCider ? new vscode.MarkdownString(docFromCider, true) : undefined;
        item.detail = details;
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

async function replCompletions(
  clientProvider: lsp.ClientProvider,
  document: vscode.TextDocument,
  position: vscode.Position,
  _token: vscode.CancellationToken,
  _context: vscode.CompletionContext
): Promise<vscode.CompletionItem[]> {
  if (!util.getConnectedState()) {
    return [];
  }
  const text = util.getWordAtPosition(document, position);

  const toplevelSelection = select.getFormSelection(document, position, true);

  util.assertIsDefined(toplevelSelection, 'Expected a topLevelSelection!');

  const toplevel = document.getText(toplevelSelection),
    toplevelStartOffset = document.offsetAt(toplevelSelection.start),
    toplevelStartCursor = docMirror.getDocument(document).getTokenCursor(toplevelStartOffset + 1),
    wordRange = document.getWordRangeAtPosition(position);

  util.assertIsDefined(wordRange, 'Expected a wordRange!');

  const wordStartLocalOffset = document.offsetAt(wordRange.start) - toplevelStartOffset,
    wordEndLocalOffset = document.offsetAt(wordRange.end) - toplevelStartOffset,
    contextStart = toplevel.substring(0, wordStartLocalOffset),
    contextEnd = toplevel.substring(wordEndLocalOffset),
    replContext = `${contextStart}__prefix__${contextEnd}`,
    toplevelIsValidForm = toplevelStartCursor.withinValidList() && replContext != '__prefix__',
    [ns, _] = namespace.getNamespace(document, position),
    client = replSession.getSession(),
    res = await client.complete(ns, text, toplevelIsValidForm ? replContext : undefined),
    results = res.completions || [];

  results.forEach((element) => {
    if (!element['ns']) {
      // make sure every entry has a namespace
      // for the 'info' call.
      element['ns'] = ns;
    }
  });
  return results.map((item) => {
    const result = new vscode.CompletionItem(
      item.candidate,
      // +1 because the LSP CompletionItemKind enum starts at 1
      // https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#completionItemKind
      (mappings[item.type] || vscode.CompletionItemKind.Text) + 1
    );
    const data = item[0] === '.' ? item.slice(1) : item;
    data['provider'] = 'repl';
    result['data'] = data;

    return result;
  });
}
