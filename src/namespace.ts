import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as docMirror from './doc-mirror/index';
import * as outputWindow from './repl-window/repl-doc';
import * as utilities from './utilities';
import * as replSession from './nrepl/repl-session';
import { NReplSession } from './nrepl';
import * as nsUtil from './util/ns-form';

export type NsAndNsForm = [string, string];

export function getNamespace(
  doc: vscode.TextDocument,
  position: vscode.Position = null
): NsAndNsForm {
  if (outputWindow.isResultsDoc(doc)) {
    const outputWindowNs = outputWindow.getNs();
    utilities.assertIsDefined(outputWindowNs, 'Expected repl window to have a namespace!');
    return [outputWindowNs, `(in-ns '${outputWindowNs})`];
  }
  if (doc && doc.languageId == 'clojure') {
    try {
      const cursorDoc = docMirror.getDocument(doc);
      return (
        nsUtil.nsFromCursorDoc(
          cursorDoc,
          position ? doc.offsetAt(position) : doc.getText().length
        ) ?? ['user', "(in-ns 'user)"]
      );
    } catch (e) {
      console.log(
        'Error getting ns form of this file using docMirror, trying with cljs.reader: ' + e
      );
      try {
        const forms = utilities.cljsLib.parseForms(doc.getText());
        if (forms !== undefined) {
          const nsFormArray = forms.filter((x) => x[0] == 'ns');
          if (nsFormArray != undefined && nsFormArray.length > 0) {
            const nsForm = nsFormArray[0].filter((x) => typeof x == 'string');
            if (nsForm != undefined) {
              return [nsForm[1], `(in-ns '${nsForm[1]})`];
            }
          }
        }
      } catch (e) {
        console.log('Error parsing ns form of this file. ' + e);
      }
    }
  }
  return ['user', "(in-ns 'user)"];
}

export async function createNamespaceFromDocumentIfNotExists(doc) {
  if (utilities.getConnectedState()) {
    const document = utilities.tryToGetDocument(doc);
    if (document) {
      const [ns, nsForm] = getNamespace(document);
      const client = replSession.getSession(utilities.getFileType(document));
      if (client) {
        const nsList = await client.listNamespaces([]);
        if (nsList && nsList['ns-list'] && nsList['ns-list'].includes(ns)) {
          return;
        }
        await client.evaluateInNs(nsForm, outputWindow.getNs());
      }
    }
  }
}

export function getDocumentNamespace(document = {}) {
  const doc = utilities.tryToGetDocument(document);

  return getNamespace(doc);
}

export async function getUriForNamespace(session: NReplSession, ns: string): Promise<vscode.Uri> {
  const info = await session.info(ns, ns);
  return vscode.Uri.parse(info.file, true);
}
