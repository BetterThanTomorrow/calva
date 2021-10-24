import * as vscode from 'vscode';
import annotations from './providers/annotations';
import * as util from './utilities';
import { NReplSession, NReplEvaluation } from './nrepl';
import * as outputWindow from './results-output/results-doc';
import * as namespace from './namespace';
import { getConfig } from './config';
import * as replSession from './nrepl/repl-session';
import * as getText from './util/get-text';

export type DocsEntry = {
    name: string;
    type: string;
    ns: string;
    doc: string;
    argsLists: string[];
    baseUrl: string;
    path: string;
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

export async function clojureDocsCiderNReplLookup(session: NReplSession, symbol: string, ns: string): Promise<DocsEntry> {
    const ciderNReplDocs = await session.clojureDocsLookup(ns, symbol);
    return ciderNRepl2DocsEntry(ciderNReplDocs.clojuredocs);
}

export async function clojureDocsLookup() {
    const doc = util.getDocument({});
    const position = vscode.window.activeTextEditor.selection.active;
    const symbol = util.getWordAtPosition(doc, position);
    const ns = namespace.getNamespace(doc);
    const session = replSession.getSession(util.getFileType(doc));

    const docs = await clojureDocsCiderNReplLookup(session, symbol, ns);
    console.log(docs);
}

function ciderNRepl2DocsEntry(docs: any): DocsEntry {
    return {
        name: docs.name,
        added: docs.added,
        baseUrl: 'https://clojuredocs.org/',
        doc: docs.doc,
        argsLists: docs.argsLists,
        examples: docs.examples,
        notes: docs.notes,
        ns: docs.ns,
        path: docs.href,
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