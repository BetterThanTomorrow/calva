import * as vscode from 'vscode';
import annotations from './providers/annotations';
import * as util from './utilities';
import { NReplSession, NReplEvaluation } from './nrepl';
import * as outputWindow from './results-output/results-doc';
import * as namespace from './namespace';
import { getConfig } from './config';
import * as replSession from './nrepl/repl-session';
import * as getText from './util/get-text';
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
};

export function init(cljSession: NReplSession) {
    cljSession.clojureDocsRefreshCache().catch(reason => {
        console.error("Error refreshing ClojureDocs cache: ", reason);
    });
}

export async function printClojureDocsToOutputWindow() {
    const docs = await clojureDocsLookup();
    if (typeof docs === 'string') {
        outputWindow.append(`;; ${docs}`)
    }
    else {
        outputWindow.append(docsEntry2ClojureCode(docs));
    }
    outputWindow.appendPrompt();
}

export async function printClojureDocsToRichComment() {
    const docs = await clojureDocsLookup();
    if (typeof docs === 'string') {
        printTextToRichComment(`;; ${docs}`);
    }
    else {
        printTextToRichComment(docsEntry2ClojureCode(docs));
    }
}

export function printTextToRichCommentCommand(args: { [x: string]: string; }) {
    printTextToRichComment(args['text']);
}

function printTextToRichComment(text: string) {
    const doc = util.getDocument({});
    const mirrorDoc = docMirror.getDocument(doc);
    paredit.addRichComment(mirrorDoc, mirrorDoc.selection.active, text);
}

export async function getExamplesHover(document, position): Promise<vscode.MarkdownString> {
    const docs = await clojureDocsLookup(document, position);
    return getHoverForDocs(docs);
}

function getHoverForDocs(docs: DocsEntry | string): vscode.MarkdownString {
    if (typeof docs === 'string') {
        return;
    }
    const webUrl = `${docs.baseUrl}/${docs.urlPath}`;
    const linkMd = `[${webUrl}](${webUrl})`;
    const hover = new vscode.MarkdownString();
    hover.isTrusted = true;
    hover.appendMarkdown('## ClojureDocs Examples\n\n');
    hover.appendMarkdown(`${linkMd}\n\n`);
    docs.examples.forEach((example, i) => {
        hover.appendMarkdown(getHoverForExample(`Example ${i + 1}`, example).value);
    });
    return hover;
    //const seeAlsos = docs.seeAlsos.map(also => `${also} ; ${docs.baseUrl}/${also.replace(/\?/g, '%3F')}`).join(`\n`);
}

function getHoverForExample(header: string, example: string): vscode.MarkdownString {
    const printToRCFCommandUri = `command:calva.printTextToRichCommentCommand?${encodeURIComponent(JSON.stringify([{ text: example }]))}`;
    const rcfCommandMd = `[As Rich Comment](${printToRCFCommandUri} "Print to Rich Comment")`;
    const hover = new vscode.MarkdownString();
    hover.isTrusted = true;
    hover.appendMarkdown(`### ${header}\n\n`);
    hover.appendMarkdown(`${rcfCommandMd}\n`);
    hover.appendCodeblock(example, 'clojure');
    return hover;
}

function docsEntry2ClojureCode(docs: DocsEntry, printDocString = false): string {
    if (typeof docs === 'string') {
        return `;; ${docs}`;
    }
    else {
        const exampleSeparatorB = `;; ------- BEGIN EXAMPLE`
        const exampleSeparatorE = `;; ------- END EXAMPLE`
        const name = `;; ${docs.ns}/${docs.name}`;
        const webUrl = `;; ${docs.baseUrl}/${docs.urlPath}`;
        // Not planning to print docs string, but keeping this code anyway =)
        const doc = docs.doc.split(/\n/).map(line => `;; ${line.replace(/^ {0,3}/, '')}`).join('\n').trim();
        const examples = docs.examples.map((example, i) => `${exampleSeparatorB} ${i + 1}\n${example.trim()}\n${exampleSeparatorE} ${i + 1}`).join('\n\n');
        const seeAlsos = docs.seeAlsos.map(also => `${also} ; ${docs.baseUrl}/${also.replace(/\?/g, '%3F')}`).join(`\n`);
        const code = `${name}\n${webUrl}\n${printDocString ? doc + '\n' : ''}\n;; Examples:\n${examples}\n\n;; See also:\n${seeAlsos}\n`;
        return code;
    }
}

async function clojureDocsCiderNReplLookup(session: NReplSession, symbol: string, ns: string): Promise<DocsEntry | string> {
    const ciderNReplDocs = await session.clojureDocsLookup(ns, symbol);
    if (ciderNReplDocs.clojuredocs) {
        return ciderNRepl2DocsEntry(ciderNReplDocs.clojuredocs);
    }
    return `Docs lookup failed: ${symbol ? 'Only Clojure core (ish) symbols supported' : 'Cursor not at a Clojure core (ish) symbol'}`;
}

async function clojureDocsLookup(d?, p?): Promise<DocsEntry | string> {
    const doc = d ? d : util.getDocument({});
    const position = p ? p : vscode.window.activeTextEditor.selection.active;
    const symbol = util.getWordAtPosition(doc, position);
    const ns = namespace.getNamespace(doc);
    const session = replSession.getSession(util.getFileType(doc));

    if (session.replType !== 'clj') {
        vscode.window.showErrorMessage('Clojuredocs Lookup is currently only supported with Clojure REPLs.');
    }

    return clojureDocsCiderNReplLookup(session, symbol, ns);
}

function ciderNRepl2DocsEntry(docs: any): DocsEntry {
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
        seeAlsos: docs['see-alsos'],
        tag: docs.tag,
        type: docs.type
    }
}
