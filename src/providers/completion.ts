import {
  TextDocument,
  Position,
  CancellationToken,
  CompletionContext,
  CompletionItemKind,
  window,
  CompletionList,
  CompletionItemProvider,
  CompletionItem,
  CompletionItemLabel,
  Uri,
} from 'vscode';
import util from '../utilities';
import select from '../select';
import docMirror from '../doc-mirror/index';
import infoparser from './infoparser';
import namespace from '../namespace';
import replSession from '../nrepl/repl-session';
import { CompletionRequest, CompletionResolveRequest } from 'vscode-languageserver-protocol';
import { createConverter } from 'vscode-languageclient/lib/common/protocolConverter';
import ProtocolCompletionItem from 'vscode-languageclient/lib/common/protocolCompletionItem';
import lsp from '../lsp';

const mappings = {
  nil: CompletionItemKind.Value,
  macro: CompletionItemKind.Value,
  class: CompletionItemKind.Class,
  keyword: CompletionItemKind.Keyword,
  namespace: CompletionItemKind.Module,
  function: CompletionItemKind.Function,
  'special-form': CompletionItemKind.Keyword,
  var: CompletionItemKind.Variable,
  method: CompletionItemKind.Method,
};

const converter = createConverter(undefined, undefined, true);

const completionProviderOptions = { priority: ['lsp', 'repl'], merge: true };

const completionFunctions = { lsp: lspCompletions, repl: replCompletions };

async function provideCompletionItems(
  clientProvider: lsp.ClientProvider,
  document: TextDocument,
  position: Position,
  token: CancellationToken,
  context: CompletionContext
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
      results = [
        ...completions
          .concat(results)
          .reduce(
            (m: Map<string | CompletionItemLabel, CompletionItem>, o: CompletionItem) =>
              m.set(o.label, Object.assign(m.get(o.label) || {}, o)),
            new Map()
          )
          .values(),
      ];
    }
  }

  const completionItems: ProtocolCompletionItem[] = results.map((completion) =>
    converter.asCompletionItem(completion)
  );

  return new CompletionList(completionItems, true);
}

export default class CalvaCompletionItemProvider implements CompletionItemProvider {
  constructor(private readonly clientProvider: lsp.ClientProvider) {}

  async provideCompletionItems(
    document: TextDocument,
    position: Position,
    token: CancellationToken,
    context: CompletionContext
  ) {
    return provideCompletionItems(this.clientProvider, document, position, token, context);
  }

  async resolveCompletionItem(item: CompletionItem, token: CancellationToken) {
    if (util.getConnectedState() && item['data']?.provider === 'repl') {
      const activeTextEditor = window.activeTextEditor;

      util.assertIsDefined(activeTextEditor, 'Expected window to have activeTextEditor defined!');

      const client = replSession.getSession(util.getFileType(activeTextEditor.document));
      if (client) {
        await namespace.createNamespaceFromDocumentIfNotExists(activeTextEditor.document);
        const ns = namespace.getDocumentNamespace();
        const result = await client.info(
          ns,
          typeof item.label === 'string' ? item.label : item['data'].label
        );
        const [doc, details] = infoparser.getCompletion(result);
        item.documentation = doc;
        item.detail = details;
      }

      return item;
    } else {
      const res = await lspResolveCompletions(
        this.clientProvider,
        window.activeTextEditor.document.uri,
        item,
        token
      );

      return converter.asCompletionItem(res);
    }
  }
}

function lspCompletions(
  clientProvider: lsp.ClientProvider,
  document: TextDocument,
  position: Position,
  token: CancellationToken,
  context: CompletionContext
) {
  const client = clientProvider.getClientForDocumentUri(document.uri);
  return client?.sendRequest(
    CompletionRequest.type,
    client.code2ProtocolConverter.asCompletionParams(document, position, context),
    token
  );
}

async function lspResolveCompletions(
  clientProvider: lsp.ClientProvider,
  uri: Uri,
  item: CompletionItem,
  token: CancellationToken
) {
  const client = clientProvider.getClientForDocumentUri(uri);
  return await client?.sendRequest(
    CompletionResolveRequest.type,
    client.code2ProtocolConverter.asCompletionItem(item),
    token
  );
}

async function replCompletions(
  clientProvider: lsp.ClientProvider,
  document: TextDocument,
  position: Position,
  _token: CancellationToken,
  _context: CompletionContext
): Promise<CompletionItem[]> {
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
    ns = namespace.getNamespace(document),
    client = replSession.getSession(util.getFileType(document)),
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
    const result = new CompletionItem(
      item.candidate,
      mappings[item.type] || CompletionItemKind.Text
    );
    const data = item[0] === '.' ? item.slice(1) : item;
    data['provider'] = 'repl';
    result['data'] = data;

    return result;
  });
}
