import * as vscode from 'vscode';
import { activeReplWindow } from './repl-window';
import * as state from './state';
import * as util from './utilities';

const connectionStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
const typeStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
const cljsBuildStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
const defaultColors = {
    disconnectedColor: "rgb(192,192,192)",
    launchingColor: "rgb(253, 208, 35)",
    connectedSatusColor: "rgb(253, 208, 35)",
    typeStatusColor: "rgb(145,220,71)"
};

function update() {

    let currentConf = vscode.workspace.getConfiguration('calva.statusColor');

    let current = state.deref(),
        doc = util.getDocument({}),
        fileType = util.getFileType(doc),
        cljsBuild = current.get('cljsBuild');

    //let disconnectedColor = "rgb(192,192,192)";

    typeStatus.command = null;
    typeStatus.text = "Disconnected";
    typeStatus.tooltip = "No active REPL session";
    typeStatus.color = currentConf.get("disconnectedColor") || defaultColors.disconnectedColor;

    connectionStatus.command = null;
    connectionStatus.tooltip = "REPL connection status";

    cljsBuildStatus.text = null;
    cljsBuildStatus.command = "calva.recreateCljsRepl";
    cljsBuildStatus.tooltip = null;

    if (current.get('connected')) {
        connectionStatus.text = "nREPL $(zap)";
        connectionStatus.color = currentConf.get("connectedSatusColor") || defaultColors.connectedSatusColor;
        connectionStatus.tooltip = `nrepl://${current.get('hostname')}:${current.get('port')} (Click to reset connection)`;
        connectionStatus.command = "calva.jackInOrConnect";
        typeStatus.color = currentConf.get("typeStatusColor") || defaultColors.typeStatusColor;
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
        if (util.getREPLSessionType() === 'cljs' && state.extensionContext.workspaceState.get('cljsReplTypeHasBuilds')) {
            if (cljsBuild !== null && util.getREPLSessionType() === 'cljs') {
                cljsBuildStatus.text = cljsBuild;
                cljsBuildStatus.tooltip = "Click to switch CLJS build REPL";
            } else if (cljsBuild === null) {
                cljsBuildStatus.text = "no build connected"
                cljsBuildStatus.tooltip = "Click to connect to a CLJS build REPL";
            }
        }
    } else if (current.get('launching')) {
        connectionStatus.color = currentConf.get("launchingColor") || defaultColors.launchingColor;
        connectionStatus.text = "Launching REPL using " + current.get('launching');
    } else if (current.get('connecting')) {
        connectionStatus.text = "nREPL - trying to connect";
    } else {
        connectionStatus.text = "nREPL $(zap)";
        connectionStatus.tooltip = "Click to connect";
        connectionStatus.color = currentConf.get("disconnectedColor") || defaultColors.disconnectedColor;
        connectionStatus.command = "calva.jackInOrConnect";
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
