const vscode = require('vscode');
const state = require('./state');

const connection = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
const type = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

function update() {
    let current = state.deref();

    if (current.get('connected')) {
        connection.text = "nrepl://" + current.get('hostname') + ":" + current.get('port');
    } else {
        connection.text = "nrepl - click to connect";
    }

    if (current.get('cljs') !== null) {
        type.color = "rgb(145,220,71)";
        type.text = "(cljs)"
    } else if (current.get('clj') !== null) {
        type.color = "rgb(144,180,254)";
        type.text = "(clj)"
    } else {
        type.color = "rgb(192,192,192)"
        type.text = "(-)"
    }
    connection.command = "visualclojure.connect";
    //type.command = "visualclojure.toggleSession";

    connection.show();
    type.show();
};

module.exports = {
    update
}
