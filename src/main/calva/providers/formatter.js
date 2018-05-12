import vscode from 'vscode';
import { deref } from '../state';
import createReplClient from '../repl/client';
import { getDocument, getFileType, getSession } from '../utilities';

class DocumentFormattingEditProvider {
    provideDocumentFormattingEdits(document) {
        let current = deref(),
            chan = current.get('outputChannel'),
            doc = getDocument(document);

        if (current.get('connected')) {
            return new Promise((resolve, reject) => {
                let client = createReplClient().once('connect', () => {
                    let msg = {
                        op: "format-code",
                        code: doc.getText(),
                        session: getSession(getFileType(doc))
                    };
                    client.send(msg, (results) => {
                        let r = results[0];
                        if (r.status.indexOf("format-code-error") !== -1) {
                            let end = r.err.indexOf("]");
                            chan.appendLine("Unable to format file - error found");
                            if (end !== -1 && end > 0) {
                                chan.appendLine(r.err.substring(0, end).replace("[", ""));
                            }
                            reject(null);
                        } else if (r.status.length === 1 && r.status.indexOf("done") !== -1) {
                            const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length))
                            let reformat = vscode.TextEdit.replace(fullRange, r["formatted-code"]);
                            resolve([reformat]);
                        } else {
                            chan.appendLine("UNHANDLED FORMAT ERROR");
                            chan.appendLine(results);
                            reject(null);
                        }
                        client.end();
                    });
                });
            });
        } else {
            return null;
        }
    }
}

export default DocumentFormattingEditProvider;
