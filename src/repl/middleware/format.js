const vscode = require('vscode');
const state = require ('../../state');
const repl = require('../client');
const message = require('../message');
const {getDocument, getFileType} = require('../../utilities');

function formatDocument(document = {}) {
    let current = state.deref();
    if(current.get('connected')) {
        let doc = getDocument(document);
        let client = repl.create().once('connect', () => {
            let msg = {op: "format-code",
                       code: doc.getText(),
                       session: current.get(getFileType(doc))};
            client.send(msg, function (results) {
                const wholeDocument = new vscode.Range(0, 0, doc.lineCount, doc.getText().length);
                let formattedDocument = results[0]["formatted-code"];
                vscode.window.activeTextEditor.edit(editor => editor.replace(wholeDocument, formattedDocument));
                client.end();
            });
        });
    }
};

module.exports = {
    formatDocument
};
