import * as vscode from 'vscode';
import * as util from './utilities';
import * as nrepl from './nrepl';
import * as lsp from './lsp';
import * as namespace from './namespace';
import * as replSession from './nrepl/repl-session';
import * as docMirror from './doc-mirror/index';
import * as paredit from './cursor-doc/paredit';
import * as output from './results-output/output';

export type DocsEntry = {
  name: string;
  type: string;
  ns: string;
  doc: string;
  argsLists: string[];
  baseUrl: string;
  urlPath: string;
  examples: string[];
  notes: string[];
  seeAlsos: string[];
  added: string;
  tag: string;
  fromServer: 'cider-nrepl' | 'clojure-lsp';
};

export function init(cljSession: nrepl.NReplSession) {
  cljSession.clojureDocsRefreshCache().catch((reason) => {
    console.error('Error refreshing ClojureDocs cache: ', reason);
  });
}

export async function printClojureDocsToOutput(clientProvider: lsp.ClientProvider) {
  const docs = await clojureDocsLookup(clientProvider);
  if (!docs) {
    return;
  }
  printTextToOutput(docsEntry2ClojureCode(docs));
}

export function printTextToOutputCommand(args: { [x: string]: string }) {
  printTextToOutput(args['text']);
}

function printTextToOutput(text: string) {
  output.appendClojureOther(text);
}

export async function printClojureDocsToRichComment(clientProvider: lsp.ClientProvider) {
  const docs = await clojureDocsLookup(clientProvider);
  if (!docs) {
    return;
  } else {
    return printTextToRichComment(docsEntry2ClojureCode(docs));
  }
}

export function printTextToRichCommentCommand(args: { [x: string]: string }) {
  return printTextToRichComment(args['text'], Number.parseInt(args['position']));
}

async function printTextToRichComment(text: string, position?: number) {
  const doc = util.getDocument({});
  const mirrorDoc = docMirror.getDocument(doc);
  return paredit.addRichComment(
    mirrorDoc,
    position ? position : mirrorDoc.selections[0].active,
    text
  );
}

export async function getExamplesHover(
  clientProvider: lsp.ClientProvider,
  document: vscode.TextDocument,
  position: vscode.Position
): Promise<vscode.MarkdownString | undefined> {
  const docs = await clojureDocsLookup(clientProvider, document, position);
  if (!docs) {
    return undefined;
  }
  return getHoverForDocs(
    docs,
    document.offsetAt(position),
    await util.isDocumentWritable(document)
  );
}

function getHoverForDocs(
  docs: DocsEntry,
  position: number,
  isWritableDocument: boolean
): vscode.MarkdownString {
  const webUrl = `${docs.baseUrl}/${docs.urlPath}`;
  const linkMd = `[${webUrl}](${webUrl})`;
  const hover = new vscode.MarkdownString();
  hover.isTrusted = true;
  hover.appendMarkdown('## ClojureDocs Examples\n\n');
  hover.appendMarkdown(`${linkMd} via ${docs.fromServer}\n\n`);
  const seeAlsos = docs.seeAlsos;
  docs.examples.forEach((example, i) => {
    const symbol = `${docs.ns}/${docs.name}`.replace(/^clojure.core\//, '');
    hover.appendMarkdown(
      getHoverForExample(
        symbol,
        `Example ${i + 1}`,
        example,
        seeAlsos,
        position,
        isWritableDocument
      ).value
    );
  });
  hover.appendMarkdown('### See also\n\n');
  hover.appendMarkdown(
    seeAlsos
      .map((also) => `* [${also.replace(/^clojure.core\//, '')}](${docs.baseUrl}/${also})`)
      .join('\n')
  );
  return hover;
}

function getHoverForExample(
  symbol: string,
  header: string,
  example: string,
  seeAlsos: string[],
  position: number,
  isWritableDocument: boolean
): vscode.MarkdownString {
  const exampleAndSeeAlsos = `;; = ${symbol} - ${header} = \n\n${example}\n;; See also:\n${seeAlsos.join(
    '\n'
  )}`;
  const printToRCFCommandUri = `command:calva.printTextToRichCommentCommand?${encodeURIComponent(
    JSON.stringify([{ text: exampleAndSeeAlsos, position: position }])
  )}`;
  const printToOutputCommandUri = `command:calva.printTextToOutputCommand?${encodeURIComponent(
    JSON.stringify([{ text: exampleAndSeeAlsos, position: position }])
  )}`;
  const rcfCommandMd = `[To Rich Comment](${printToRCFCommandUri} "Print the example to a \`(comment ...)\` block")`;
  const outputCommandMd = `[To Output](${printToOutputCommandUri} "Print the example to the Output")`;
  const hover = new vscode.MarkdownString();
  hover.isTrusted = true;
  hover.appendMarkdown(`### ${header}\n\n`);
  if (isWritableDocument) {
    hover.appendMarkdown(`${rcfCommandMd} | ${outputCommandMd}\n`);
  }
  hover.appendCodeblock(example, 'clojure');
  return hover;
}

function docsEntry2ClojureCode(docs: DocsEntry, printDocString = false): string {
  const exampleSeparatorB = `;; ------- BEGIN EXAMPLE`;
  const exampleSeparatorE = `;; ------- END EXAMPLE`;
  const name = `;; ${docs.ns}/${docs.name}`;
  const webUrl = `;; ${docs.baseUrl}/${docs.urlPath}`;
  // Not planning to print docs string, but keeping this code anyway =)
  const doc = docs.doc
    .split(/\n/)
    .map((line) => `;; ${line.replace(/^ {0,3}/, '')}`)
    .join('\n')
    .trim();
  const examples = docs.examples
    .map(
      (example, i) =>
        `${exampleSeparatorB} ${i + 1}\n${example.trim()}\n${exampleSeparatorE} ${i + 1}`
    )
    .join('\n\n');
  const seeAlsos = docs.seeAlsos.map((also) => `${also.replace(/^clojure.core\//, '')}`).join(`\n`);
  const code = `${name}\n${webUrl}\n${
    printDocString ? doc + '\n' : ''
  }\n;; Examples:\n${examples}\n\n;; See also:\n${seeAlsos}\n`;
  return code;
}

async function clojureDocsLookup(
  clientProvider: lsp.ClientProvider,
  d?: vscode.TextDocument,
  p?: vscode.Position
): Promise<DocsEntry | undefined> {
  const doc = d ? d : util.getDocument({});
  const position = p ? p : util.getActiveTextEditor().selections[0].active;
  const symbol = util.getWordAtPosition(doc, position);
  const [ns, _] = namespace.getNamespace(doc, p);
  const session = replSession.getSession(util.getFileType(doc));

  const docsFromCider = await clojureDocsCiderNReplLookup(session, symbol, ns);
  if (docsFromCider) {
    return docsFromCider;
  } else {
    return clojureDocsLspLookup(clientProvider, session, doc.uri, symbol, ns);
  }
}

async function clojureDocsCiderNReplLookup(
  session: nrepl.NReplSession,
  symbol: string,
  ns: string
): Promise<DocsEntry | undefined> {
  const ciderNReplDocs = await session.clojureDocsLookup(ns, symbol);
  if (ciderNReplDocs) {
    ciderNReplDocs.fromServer = 'cider-nrepl';
    return rawDocs2DocsEntry(ciderNReplDocs, symbol, ns);
  } else {
    return undefined;
  }
}

async function clojureDocsLspLookup(
  clientProvider: lsp.ClientProvider,
  session: nrepl.NReplSession,
  uri: vscode.Uri,
  symbol: string,
  ns: string
): Promise<DocsEntry | undefined> {
  const resolved = await session.info(ns, symbol);
  if (resolved && resolved.ns) {
    const symNs =
      typeof resolved.ns === 'string' ? resolved.ns : ns.length > 0 ? ns[1] : 'clojure.core';
    const normalizedSymNs = symNs.replace(/^cljs\./, 'clojure.');
    try {
      const client = clientProvider.getClientForDocumentUri(uri);
      if (!client) {
        return;
      }

      const docs = await lsp.api.getClojureDocs(client, {
        symName: resolved.name,
        symNs: normalizedSymNs,
      });
      if (!docs) {
        return;
      }

      return rawDocs2DocsEntry(
        { clojuredocs: docs, fromServer: 'clojure-lsp' },
        resolved.name,
        resolved.ns
      );
    } catch {
      return rawDocs2DocsEntry(
        { clojuredocs: null, fromServer: 'clojure-lsp' },
        resolved.name,
        resolved.ns
      );
    }
  }
}

function rawDocs2DocsEntry(docsResult: any, symbol: string, ns: string): DocsEntry | undefined {
  const docs = docsResult.clojuredocs;
  if (docs) {
    return {
      name: docs.name,
      added: docs.added,
      baseUrl: 'https://clojuredocs.org',
      doc: docs.doc,
      argsLists: docs.argsLists,
      examples: docs.examples,
      notes: docs.notes,
      ns: docs.ns,
      urlPath: docs.href.replace(/^\/?/, ''),
      seeAlsos: docsResult.fromServer === 'clojure-lsp' ? docs['seeAlsos'] : docs['see-alsos'],
      tag: docs.tag,
      type: docs.type,
      fromServer: docsResult.fromServer,
    };
  } else {
    // console.log(`No results for ${ns}/${symbol} from ${docsResult.fromServer}`);
    return undefined;
  }
}
