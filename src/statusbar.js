const vscode = require('vscode');
const state = require('./state');
const util = require('./utilities');

const connection = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
const type = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

function update() {
    let current = state.deref(),
        doc = util.getDocument({}),
        fileType = util.getFileType(doc);

    type.command = null;
    connection.command = "clojure4vscode.connect";

    if (current.get('connected')) {
        connection.text = "nrepl://" + current.get('hostname') + ":" + current.get('port');
        type.color = "rgb(145,220,71)";
        if (fileType == 'cljs' && current.get('cljs') !== null) {
            type.text = "(cljs)"
        } else if (fileType == 'clj' & current.get('clj') !== null) {
            type.text = "(clj)"
        } else if (fileType == 'cljc' & current.get('cljc') !== null) {
            type.text = "(cljc/" + (current.get('cljc') == current.get('clj') ? 'clj' : 'cljs') + ")"
            type.command = "clojure4vscode.toggleCLJCSession";
        } else {
            type.color = "rgb(192,192,192)"
            type.text = "(-)"
        }
    } else {
        connection.text = "nrepl - click to connect";
        type.color = "rgb(192,192,192)"
        type.text = "(-)"
    }


    connection.show();
    type.show();
};

module.exports = {
    update
}
