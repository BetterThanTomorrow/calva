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
    type.tooltip = "Repl type (clj or cljs)";
    connection.command = "clojure4vscode.connect";
    connection.tooltip = "Repl connection";

    if (current.get('connected')) {
        connection.text = "nrepl://" + current.get('hostname') + ":" + current.get('port');
        type.color = "rgb(145,220,71)";
        if (fileType == 'cljs' && util.getSession('cljs') !== null) {
            type.text = "(cljs)";
            type.tooltip = "Connected to cljs repl";
        } else if (fileType == 'clj' && util.getSession('clj') !== null) {
            type.text = "(clj)"
            type.tooltip = "Connected to clj repl";
        } else if (fileType == 'cljc' && util.getSession('cljc') !== null) {
            type.text = "(cljc/" + (util.getSession('cljc') == util.getSession('clj') ? 'clj' : 'cljs') + ")"
            type.command = "clojure4vscode.toggleCLJCSession";
            type.tooltip = "Click to use " + (util.getSession('cljc') == util.getSession('clj') ? 'cljs' : 'clj') + " repl for cljc";
        } else {
            type.text = "(clj)"
            type.tooltip = "Connected to clj repl";
        }
    } else {
        connection.text = "nrepl - click to connect";
        type.color = "rgb(192,192,192)";
        type.text = "(-)";
    }

    connection.show();
    type.show();
};

module.exports = {
    update
}
