const vscode = require('vscode');
const state = require('./state');
const util = require('./utilities');

const connection = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
const type = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

function update() {
    let current = state.deref(),
        doc = util.getDocument({}),
        fileType = util.getFileType(doc);

    if (current.get('connected')) {
        connection.text = "nrepl://" + current.get('hostname') + ":" + current.get('port');
    } else {
        connection.text = "nrepl - click to connect";
    }

    if (fileType == 'cljs' && current.get('cljs') !== null) {
        type.color = "rgb(145,220,71)";
        type.text = "(cljs)"
    } else if (fileType == 'clj' & current.get('clj') !== null) {
        type.color = "rgb(144,180,254)";
        type.text = "(clj)"
    } else if (fileType == 'cljc' & current.get('cljc') !== null) {
        type.color = "rgb(144,180,254)";
        type.text = "(clj)"
    } else {
        type.color = "rgb(192,192,192)"
        type.text = "(-)"
    }
    connection.command = "clojure4vscode.connect";
    //type.command = "clojure4vscode.toggleSession";

    connection.show();
    type.show();
};

module.exports = {
    update
}
