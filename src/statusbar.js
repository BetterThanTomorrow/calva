const vscode = require('vscode');
const state = require('./state');
const util = require('./utilities');
const shadow_util = require('./shadow');


const connection = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
const type = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
const shadow = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
const indent = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

function update() {
    let current = state.deref(),
        doc = util.getDocument({}),
        fileType = util.getFileType(doc),
        autoAdjustIndent = current.get('autoAdjustIndent'),
        shadowBuild = current.get('shadowBuild');

    type.command = null;
    type.tooltip = "Repl type (clj or cljs)";
    connection.command = null;
    connection.tooltip = "Repl connection status";
    shadow.text = null;
    shadow.command = "calva.recreateCljsRepl";
    shadow.tooltip = null;
    indent.text = "AAI: " + (autoAdjustIndent ? "on" : "off");
    indent.command = "calva.toggleAutoAdjustIndent";
    indent.tooltip = (autoAdjustIndent ? "Disable" : "Enable") + " auto adjustment of indents for new lines"

    if (current.get('connected')) {
        connection.text = "nREPL $(zap)";
        connection.color = "rgb(253, 208, 35)";
        connection.tooltip = `nrepl://${current.get('hostname')}:${current.get('port')} (Click to reset connection)`;
        connection.command = "calva.connect";
        type.color = "rgb(145,220,71)";
        if (fileType == 'cljc' && util.getREPLSessionType() !== null) {
            type.text = "cljc/" + util.getREPLSessionType()
            if (util.getSession('clj') !== null && util.getSession('cljs') !== null) {
                type.command = "calva.toggleCLJCSession";
                type.tooltip = `Click to use ${(util.getREPLSessionType() === 'clj' ? 'cljs' : 'clj')} repl for cljc`;
            }
        } else if (util.getREPLSessionType() === 'cljs') {
            type.text = "cljs";
            type.tooltip = "Connected to cljs repl";
        } else if (util.getREPLSessionType() === 'clj') {
            type.text = "clj"
            type.tooltip = "Connected to clj repl";
        }
        if (shadow_util.isShadowCljs()) {
            if (shadowBuild !== null && util.getREPLSessionType() === 'cljs') {
                shadow.text = shadowBuild;
                shadow.tooltip = "Click to connect to another shadow-cljs build";
            } else if (shadowBuild === null) {
                shadow.text = "no build connected"
                shadow.tooltip = "Click to connect to a shadow-cljs build";
            }
        }
    } else if (current.get('connecting')) {
        connection.text = "nREPL - trying to connect";
        type.color = "rgb(63,192,192)";
        type.text = "...";
    } else {
        connection.text = "nREPL $(zap)";
        connection.tooltip = "Click to connect";
        connection.command = "calva.connect";
        type.color = "rgb(192,192,192)";
        type.text = "...";
    }

    connection.show();
    type.show();
    if (shadow.text) {
        shadow.show();
    } else {
        shadow.hide();
    }
    indent.show();
};

module.exports = {
    update
}
