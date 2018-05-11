import vscode from 'vscode';
import * as state from '../state';
import repl from '../repl/client';
import * as util from '../utilities';

class DocumentFormattingEditProvider {
    constructor() {
        this.state = state;
    }

    provideDocumentFormattingEdits(document) {
        let current = state.deref(),
            chan = current.get('outputChannel'),
            doc = util.getDocument(document);

        if (current.get('connected')) {
            return new Promise((resolve, reject) => {
                let client = repl.create().once('connect', () => {
                    let msg = {
                        op: "format-code",
                        code: doc.getText(),
                        session: util.getSession(util.getFileType(doc))
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
