const vscode = require('vscode');
const nreplClient = require('../nrepl/client');
const nreplMsg = require('../nrepl/message');
const helpers = require('../clojure/helpers');
const ignoreNextSave = [];

function formatDocument(current, document = {}) {
    let doc = helpers.getDocument(document);

    if (doc.languageId !== 'clojure' || ignoreNextSave.length > 0) {
        return;
    }

    if(current.connected) {
        let filetypeIndex = (doc.fileName.lastIndexOf('.') + 1),
            filetype = doc.fileName.substr(filetypeIndex, doc.fileName.length),
            client = nreplClient.create({
                host: current.hostname,
                port: current.port
            }).once('connect', () => {
            let msg = {op: "format-code",
                       code: doc.getText(),
                       session: current.session[filetype]};
            client.send(msg, function (results) {
                let r = results[0];
                if (r.status.indexOf("format-code-error") !== -1) {
                    let chan = current.outputChannel,
                        end = r.err.indexOf("]");
                    chan.appendLine("Unable to format file - error found");
                    if (end !== -1 && end > 0) {
                        chan.appendLine(r.err.substring(0, end).replace("[", ""));
                    }
                } else if (r.status.length === 1 && r.status.indexOf("done") !== -1){
                    const wholeDocument = new vscode.Range(0, 0, doc.lineCount, doc.getText().length);
                    let formattedDocument = results[0]["formatted-code"],
                        active = vscode.window.activeTextEditor;

                    if (active.document === doc) {
                        active.edit(editor => editor.replace(wholeDocument, formattedDocument));
                        ignoreNextSave.push(doc);
                        doc.save().then(() => {
                            ignoreNextSave.pop();
                        });;
                    }
                    client.end();
                } else {
                    console.log("UNHANDLED FORMAT ERROR");
                    console.log(results);
                }
            });
        });
    }
};

module.exports = {
    formatDocument,
    ignoreNextSave
};
