import * as vscode from 'vscode';
import * as state from './state';
import * as util from './utilities';
import * as shadow_util from './shadow';
import { activeReplWindow } from './repl-window';


const connectionStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
const typeStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
const cljsBuildStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

function update() {
    let current = state.deref(),
        doc = util.getDocument({}),
        fileType = util.getFileType(doc),
        cljsBuild = current.get('cljsBuild');

    let disconnectedColor = "rgb(192,192,192)";

    typeStatus.command = null;
    typeStatus.text = "Disconnected";
    typeStatus.tooltip = "No active REPL session";
    typeStatus.color = disconnectedColor;

    connectionStatus.command = null;
    connectionStatus.tooltip = "REPL connection status";

    cljsBuildStatus.text = null;
    cljsBuildStatus.command = "calva.recreateCljsRepl";
    cljsBuildStatus.tooltip = null;

    if (current.get('connected')) {
        connectionStatus.text = "nREPL $(zap)";
        connectionStatus.color = "rgb(253, 208, 35)";
        connectionStatus.tooltip = `nrepl://${current.get('hostname')}:${current.get('port')} (Click to reset connection)`;
        connectionStatus.command = "calva.connect";
        typeStatus.color = "rgb(145,220,71)";
        if (fileType == 'cljc' && util.getREPLSessionType() !== null && !activeReplWindow()) {
            typeStatus.text = "cljc/" + util.getREPLSessionType()
            if (util.getSession('clj') !== null && util.getSession('cljs') !== null) {
                typeStatus.command = "calva.toggleCLJCSession";
                typeStatus.tooltip = `Click to use ${(util.getREPLSessionType() === 'clj' ? 'cljs' : 'clj')} REPL for cljc`;
            }
        } else if (util.getREPLSessionType() === 'cljs') {
            typeStatus.text = "cljs";
            typeStatus.tooltip = "Connected to ClojureScript REPL";
        } else if (util.getREPLSessionType() === 'clj') {
            typeStatus.text = "clj"
            typeStatus.tooltip = "Connected to Clojure REPL";
        }
        if (shadow_util.isShadowCljs()) {
            if (cljsBuild !== null && util.getREPLSessionType() === 'cljs') {
                cljsBuildStatus.text = cljsBuild;
                cljsBuildStatus.tooltip = "Click to switch CLJS REPL";
            } else if (cljsBuild === null) {
                cljsBuildStatus.text = "no cljs REPL connected"
                cljsBuildStatus.tooltip = "Click to connect to a shadow-cljs CLJS REPL";
            }
        }
    } else if (current.get('launching')) {
        connectionStatus.color = "rgb(253, 208, 35)";
        connectionStatus.text = "Launching REPL using "+current.get('launching');
    } else if (current.get('connecting')) {
        connectionStatus.text = "nREPL - trying to connect";
    } else {
        connectionStatus.text = "nREPL $(zap)";
        connectionStatus.tooltip = "Click to connect";
        connectionStatus.color = disconnectedColor;
        connectionStatus.command = "calva.connect";
    }

    connectionStatus.show();
    typeStatus.show();
    if (cljsBuildStatus.text) {
        cljsBuildStatus.show();
    } else {
        cljsBuildStatus.hide();
    }
}

export default {
    update
};
