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
    const doc = util.getDocument({});
    const mirrorDoc = docMirror.getDocument(doc);
    const docs = await clojureDocsLookup();
    if (typeof docs === 'string') {
        paredit.addRichComment(mirrorDoc, mirrorDoc.selection.active, `;; ${docs}`);
    }
    else {
        paredit.addRichComment(mirrorDoc, mirrorDoc.selection.active, docsEntry2ClojureCode(docs));
    }    
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
        const examples = docs.examples.map((example, i) => `${exampleSeparatorB} ${i+1}\n${example.trim()}\n${exampleSeparatorE} ${i+1}`).join('\n\n');
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

async function clojureDocsLookup(): Promise<DocsEntry | string> {
    const doc = util.getDocument({});
    const position = vscode.window.activeTextEditor.selection.active;
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

//export function getHoverText() {
//    const copyCommandUri = `command:calva.copyAnnotationHoverText?${encodeURIComponent(JSON.stringify([{ text: resultString }]))}`,
//    copyCommandMd = `[Copy](${copyCommandUri} "Copy results to the clipboard")`;
//    const openWindowCommandUri = `command:calva.showOutputWindow`,
//    openWindowCommandMd = `[Open Output Window](${openWindowCommandUri} "Open the output window")`;
//    const hoverMessage = new vscode.MarkdownString(`${copyCommandMd} | ${openWindowCommandMd}\n` + '```clojure\n' + resultString + '\n```');
//    hoverMessage.isTrusted = true;
//    decoration["hoverMessage"] = status == AnnotationStatus.ERROR ? resultString : hoverMessage;
//}