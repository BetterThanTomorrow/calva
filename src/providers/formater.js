const vscode = require('vscode');
const state = require('../state');
const repl = require('../repl/client');
const {
    getDocument,
    getFileType,
    getSession
} = require('../utilities');

module.exports = class DocumentFormattingEditProvider {
    constructor() {
        this.state = state;
    }

    provideDocumentFormattingEdits(document, options, token) {
        let current = state.deref(),
            doc = getDocument(document);

        if (current.get('connected')) {
            let client = null;
            return new Promise((resolve, reject) => {
                client = repl.create().once('connect', () => {
                    let msg = {
                        op: "format-code",
                        code: doc.getText(),
                        session: getSession(getFileType(doc))
                    };
                    client.send(msg, function (results) {
                        let r = results[0];
                        if (r.status.indexOf("format-code-error") !== -1) {
                            let chan = state.deref().get('outputChannel'),
                                end = r.err.indexOf("]");
                            chan.appendLine("Unable to format file - error found");
                            if (end !== -1 && end > 0) {
                                chan.appendLine(r.err.substring(0, end).replace("[", ""));
                            }
                            reject(null);
                        } else if (r.status.length === 1 && r.status.indexOf("done") !== -1) {
                            const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length - 1))
                            let formattedDocument = [vscode.TextEdit.replace(fullRange, results[0]["formatted-code"])]
                            resolve(formattedDocument);
                        } else {
                            console.log("UNHANDLED FORMAT ERROR");
                            console.log(results);
                            reject(null);
                        }
                    });
                });
            }).then((formatresult) => {
                client.end();
                return formatresult;
            });
        } else {
            return null;
        }
    }
};
