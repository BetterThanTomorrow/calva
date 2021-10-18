import * as vscode from 'vscode';
import annotations from './providers/annotations';
import * as util from './utilities';
import { NReplSession, NReplEvaluation } from './nrepl';
import * as outputWindow from './results-output/results-doc';
import * as namespace from './namespace';
import { getConfig } from './config';
import * as replSession from './nrepl/repl-session';
import * as getText from './util/get-text';


export function init(cljSession: NReplSession) {
    cljSession.clojureDocsRefreshCache().catch(reason => {
        console.error("Error refreshing ClojureDocs cache: ", reason);
    });
}

export async function clojureDocsLookupSymbol(symbol: string) {
    const doc = util.getDocument({});
    const ns = namespace.getNamespace(doc);
    //const session = replSession.getSession(util.getFileType(doc));
    const session = replSession.getSession("clj");
    const docs = await session.clojureDocsLookup(ns, symbol);
    console.log(docs);
}

export async function clojureDocsLookup() {
    const doc = util.getDocument({});
    const position = vscode.window.activeTextEditor.selection.active;
    const symbol = util.getWordAtPosition(doc, position);

    await clojureDocsLookupSymbol(symbol);
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