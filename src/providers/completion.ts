import {
  TextDocument,
  Position,
  CancellationToken,
  CompletionContext,
  Hover,
  CompletionItemKind,
  window,
  CompletionList,
  CompletionItemProvider,
  CompletionItem,
  CompletionItemLabel,
} from 'vscode';
import * as util from '../utilities';
import select from '../select';
import * as docMirror from '../doc-mirror/index';
import * as infoparser from './infoparser';
import * as namespace from '../namespace';
import * as replSession from '../nrepl/repl-session';
import { getClient } from '../lsp/main';
import { CompletionRequest, CompletionResolveRequest } from 'vscode-languageserver-protocol';
import { createConverter } from 'vscode-languageclient/lib/common/protocolConverter';

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

const converter = createConverter(undefined, undefined);

const completionProviderOptions = { priority: ['lsp', 'repl'], merge: true };

const completionFunctions = { lsp: lspCompletions, repl: replCompletions };

async function provideCompletionItems(
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
    const completions = await completionFunctions[provider](document, position, token, context);

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

  return new CompletionList(results.map(converter.asCompletionItem), true);
}

export default class CalvaCompletionItemProvider implements CompletionItemProvider {
  async provideCompletionItems(
    document: TextDocument,
    position: Position,
    token: CancellationToken,
    context: CompletionContext
  ) {
    return provideCompletionItems(document, position, token, context);
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
      const res = await lspResolveCompletions(item, token);

      return converter.asCompletionItem(res);
    }
  }
}

async function lspCompletions(
  document: TextDocument,
  position: Position,
  token: CancellationToken,
  context: CompletionContext
) {
  const lspClient = await getClient(20);
  return lspClient.sendRequest(
    CompletionRequest.type,
    lspClient.code2ProtocolConverter.asCompletionParams(document, position, context),
    token
  );
}

async function lspResolveCompletions(item: CompletionItem, token: CancellationToken) {
  const lspClient = await getClient(20);
  return lspClient.sendRequest(
    CompletionResolveRequest.type,
    lspClient.code2ProtocolConverter.asCompletionItem(item),
    token
  );
}

async function replCompletions(
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
