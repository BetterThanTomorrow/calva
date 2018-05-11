import vscode from 'vscode';
import * as state from './state';
import * as util from './utilities';
import shadow_util from './shadow';


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

    let disconnectedColor = "rgb(192,192,192)";

    type.command = null;
    type.text = "Disconnected";
    type.tooltip = "No active REPL session";
    type.color = disconnectedColor;

    connection.command = null;
    connection.tooltip = "REPL connection status";

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
                type.tooltip = `Click to use ${(util.getREPLSessionType() === 'clj' ? 'cljs' : 'clj')} REPL for cljc`;
            }
        } else if (util.getREPLSessionType() === 'cljs') {
            type.text = "cljs";
            type.tooltip = "Connected to ClojureScript REPL";
        } else if (util.getREPLSessionType() === 'clj') {
            type.text = "clj"
            type.tooltip = "Connected to Clojure REPL";
        }
        if (shadow_util.isShadowCljs()) {
            if (shadowBuild !== null && util.getREPLSessionType() === 'cljs') {
                shadow.text = shadowBuild;
                shadow.tooltip = "Click to connect to another Shadow CLJS build";
            } else if (shadowBuild === null) {
                shadow.text = "no build connected"
                shadow.tooltip = "Click to connect to a Shadow CLJS build";
            }
        }
    } else if (current.get('connecting')) {
        connection.text = "nREPL - trying to connect";
    } else {
        connection.text = "nREPL $(zap)";
        connection.tooltip = "Click to connect";
        connection.color = disconnectedColor;
        connection.command = "calva.connect";
    }

    connection.show();
    type.show();
    if (shadow.text) {
        shadow.show();
    } else {
        shadow.hide();
    }
    indent.show();
}

export default {
    update
};
