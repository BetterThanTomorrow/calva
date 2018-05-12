import vscode from 'vscode';
import { deref } from './state';
import { getDocument, getFileType, getREPLSessionType, getSession } from './utilities';
import { isShadowCljs } from './shadow';


const connection = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
const type = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
const shadow = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
const indent = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

function updateStatusBar() {
    let current = deref(),
        doc = getDocument({}),
        fileType = getFileType(doc),
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
        if (fileType == 'cljc' && getREPLSessionType() !== null) {
            type.text = "cljc/" + getREPLSessionType()
            if (getSession('clj') !== null && getSession('cljs') !== null) {
                type.command = "calva.toggleCLJCSession";
                type.tooltip = `Click to use ${(getREPLSessionType() === 'clj' ? 'cljs' : 'clj')} REPL for cljc`;
            }
        } else if (getREPLSessionType() === 'cljs') {
            type.text = "cljs";
            type.tooltip = "Connected to ClojureScript REPL";
        } else if (getREPLSessionType() === 'clj') {
            type.text = "clj"
            type.tooltip = "Connected to Clojure REPL";
        }
        if (isShadowCljs()) {
            if (shadowBuild !== null && getREPLSessionType() === 'cljs') {
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

export default updateStatusBar;
