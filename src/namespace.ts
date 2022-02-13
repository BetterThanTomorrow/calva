import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as docMirror from './doc-mirror/index';
import { LispTokenCursor } from './cursor-doc/token-cursor';
import { Token } from './cursor-doc/clojure-lexer';
import * as outputWindow from './results-output/results-doc';
import * as utilities from './utilities';
import * as replSession from './nrepl/repl-session';
import { NReplSession } from './nrepl';

export function getNamespace(doc: vscode.TextDocument) {
    if (outputWindow.isResultsDoc(doc)) {
        return outputWindow.getNs();
    }
    let ns = 'user';
    if (doc && doc.languageId == 'clojure') {
        try {
            const cursor: LispTokenCursor = docMirror
                .getDocument(doc)
                .getTokenCursor(0);
            cursor.forwardWhitespace(true);
            let token: Token = null,
                foundNsToken: boolean = false,
                foundNsId: boolean = false;
            do {
                cursor.downList();
                if (token && token.offset == cursor.getToken().offset) {
                    cursor.next();
                }
                token = cursor.getToken();
                foundNsToken = token.type == 'id' && token.raw == 'ns';
            } while (!foundNsToken && !cursor.atEnd());
            if (foundNsToken) {
                do {
                    cursor.next();
                    token = cursor.getToken();
                    foundNsId = token.type == 'id';
                } while (!foundNsId && !cursor.atEnd());
                if (foundNsId) {
                    ns = token.raw;
                } else {
                    console.log('Error getting the ns name from the ns form.');
                }
            } else {
                console.log('No ns form found.');
            }
        } catch (e) {
            console.log(
                'Error getting ns form of this file using docMirror, trying with cljs.reader: ' +
                    e
            );
            try {
                const forms = utilities.cljsLib.parseForms(doc.getText());
                if (forms !== undefined) {
                    const nsFormArray = forms.filter((x) => x[0] == 'ns');
                    if (nsFormArray != undefined && nsFormArray.length > 0) {
                        const nsForm = nsFormArray[0].filter(
                            (x) => typeof x == 'string'
                        );
                        if (nsForm != undefined) {
                            ns = nsForm[1];
                        }
                    }
                }
            } catch (e) {
                console.log('Error parsing ns form of this file. ' + e);
            }
        }
    }
    return ns;
}

export async function createNamespaceFromDocumentIfNotExists(doc) {
    if (utilities.getConnectedState()) {
        const document = utilities.getDocument(doc);
        if (document) {
            const ns = getNamespace(document);
            const client = replSession.getSession(
                utilities.getFileType(document)
            );
            if (client) {
                const nsList = await client.listNamespaces([]);
                if (nsList['ns-list'] && nsList['ns-list'].includes(ns)) {
                    return;
                }
                await client.eval('(ns ' + ns + ')', client.client.ns).value;
            }
        }
    }
}

export function getDocumentNamespace(document = {}) {
    const doc = utilities.getDocument(document);

    return getNamespace(doc);
}

export async function getUriForNamespace(
    session: NReplSession,
    ns: string
): Promise<vscode.Uri> {
    const info = await session.info(ns, ns);
    return vscode.Uri.parse(info.file, true);
}
