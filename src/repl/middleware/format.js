const vscode = require('vscode');
const state = require ('../../state');
const repl = require('../client');
const message = require('../message');
const {getDocument, getFileType} = require('../../utilities');
const ignoreNextSave = [];

function formatDocument(document) {
    let current = state.deref();
    if (document.languageId !== 'clojure' || ignoreNextSave.length > 0) {
        return;
    }

    if(current.get('connected')) {
        let doc = getDocument(document);
        let client = repl.create().once('connect', () => {
            let msg = {op: "format-code",
                       code: doc.getText(),
                       session: current.get(getFileType(doc))};
            client.send(msg, function (results) {
                const wholeDocument = new vscode.Range(0, 0, doc.lineCount, doc.getText().length);
                let formattedDocument = results[0]["formatted-code"],
                    active = vscode.window.activeTextEditor;

                if (active.document === document) {
                    active.edit(editor => editor.replace(wholeDocument, formattedDocument));
                    ignoreNextSave.push(document);
                    document.save().then(() => {
                        ignoreNextSave.pop();
                    });;
                }
                client.end();
            });
        });
    }
};

module.exports = {
    formatDocument
};
