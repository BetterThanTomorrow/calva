import * as vscode from 'vscode';
import * as util from './utilities';
import * as nrepl from './nrepl';
import * as lsp from './lsp/main';
import * as outputWindow from './results-output/results-doc';
import * as namespace from './namespace';
import { getConfig } from './config';
import * as replSession from './nrepl/repl-session';
import * as docMirror from './doc-mirror/index';
import * as paredit from './cursor-doc/paredit';

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

export async function printClojureDocsToOutputWindow() {
    const docs = await clojureDocsLookup();
    if (!docs) {
        return;
    }
    printTextToOutputWindow(docsEntry2ClojureCode(docs));
}

export function printTextToOutputWindowCommand(args: { [x: string]: string }) {
    printTextToOutputWindow(args['text']);
}

function printTextToOutputWindow(text: string) {
    outputWindow.append(text);
    outputWindow.appendPrompt();
}

export async function printClojureDocsToRichComment() {
    const docs = await clojureDocsLookup();
    if (!docs) {
        return;
    } else {
        printTextToRichComment(docsEntry2ClojureCode(docs));
    }
}

export function printTextToRichCommentCommand(args: { [x: string]: string }) {
    printTextToRichComment(args['text'], Number.parseInt(args['position']));
}

function printTextToRichComment(text: string, position?: number) {
    const doc = util.getDocument({});
    const mirrorDoc = docMirror.getDocument(doc);
    paredit.addRichComment(
        mirrorDoc,
        position ? position : mirrorDoc.selection.active,
        text
    );
}

export async function getExamplesHover(
    document: vscode.TextDocument,
    position: vscode.Position
): Promise<vscode.MarkdownString> {
    const docs = await clojureDocsLookup(document, position);
    if (!docs) {
        return null;
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
    const seeAlsos = docs.seeAlsos.map(
        (also) => `${also.replace(/^clojure.core\//, '')}`
    );
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
    hover.appendCodeblock(seeAlsos.join('\n'), 'clojure');
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
    const printToOutputWindowCommandUri = `command:calva.printTextToOutputWindowCommand?${encodeURIComponent(
        JSON.stringify([{ text: exampleAndSeeAlsos, position: position }])
    )}`;
    const rcfCommandMd = `[To Rich Comment](${printToRCFCommandUri} "Print the example to a \`(comment ...)\` block")`;
    const outputWindowCommandMd = `[To Output Window](${printToOutputWindowCommandUri} "Print the example to the Output/REPL Window")`;
    const hover = new vscode.MarkdownString();
    hover.isTrusted = true;
    hover.appendMarkdown(`### ${header}\n\n`);
    if (isWritableDocument) {
        hover.appendMarkdown(`${rcfCommandMd} | ${outputWindowCommandMd}\n`);
    }
    hover.appendCodeblock(example, 'clojure');
    return hover;
}

function docsEntry2ClojureCode(
    docs: DocsEntry,
    printDocString = false
): string {
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
                `${exampleSeparatorB} ${
                    i + 1
                }\n${example.trim()}\n${exampleSeparatorE} ${i + 1}`
        )
        .join('\n\n');
    const seeAlsos = docs.seeAlsos
        .map((also) => `${also.replace(/^clojure.core\//, '')}`)
        .join(`\n`);
    const code = `${name}\n${webUrl}\n${
        printDocString ? doc + '\n' : ''
    }\n;; Examples:\n${examples}\n\n;; See also:\n${seeAlsos}\n`;
    return code;
}

async function clojureDocsLookup(
    d?: vscode.TextDocument,
    p?: vscode.Position
): Promise<DocsEntry> {
    const doc = d ? d : util.getDocument({});
    const position = p ? p : vscode.window.activeTextEditor.selection.active;
    const symbol = util.getWordAtPosition(doc, position);
    const ns = namespace.getNamespace(doc);
    const session = replSession.getSession(util.getFileType(doc));

    const docsFromCider = await clojureDocsCiderNReplLookup(
        session,
        symbol,
        ns
    );
    if (docsFromCider) {
        return docsFromCider;
    } else {
        return clojureDocsLspLookup(session, symbol, ns);
    }
}

async function clojureDocsCiderNReplLookup(
    session: nrepl.NReplSession,
    symbol: string,
    ns: string
): Promise<DocsEntry> {
    const ciderNReplDocs = await session.clojureDocsLookup(ns, symbol);
    ciderNReplDocs.fromServer = 'cider-nrepl';
    return rawDocs2DocsEntry(ciderNReplDocs, symbol, ns);
}

async function clojureDocsLspLookup(
    session: nrepl.NReplSession,
    symbol: string,
    ns: string
): Promise<DocsEntry> {
    const resolved = await session.info(ns, symbol);
    const symNs = resolved.ns.replace(/^cljs\./, 'clojure.');
    try {
        const docs = await lsp.getClojuredocs(resolved.name, symNs);
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

function rawDocs2DocsEntry(
    docsResult: any,
    symbol: string,
    ns: string
): DocsEntry {
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
            seeAlsos:
                docsResult.fromServer === 'clojure-lsp'
                    ? docs['see-alsos'].map(
                          (also) => `${also.sym.ns}/${also.sym.name}`
                      )
                    : docs['see-alsos'],
            tag: docs.tag,
            type: docs.type,
            fromServer: docsResult.fromServer,
        };
    } else {
        // console.log(`No results for ${ns}/${symbol} from ${docsResult.fromServer}`);
        return null;
    }
}
