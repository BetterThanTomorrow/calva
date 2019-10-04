import * as vscode from 'vscode';
import { activeReplWindow } from './repl-window';
import * as state from './state';
import * as util from './utilities';

const connectionStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
const typeStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
const cljsBuildStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
const prettyPrintToggle = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
const color = {
    active: "white",
    inactive: "#b3b3b3"
};

function colorValue(section: string, currentConf: vscode.WorkspaceConfiguration):string {
    let { defaultValue, globalValue, workspaceFolderValue, workspaceValue} = currentConf.inspect(section);

    return workspaceFolderValue || workspaceValue || globalValue || defaultValue;
}

function update() {

    let currentConf = vscode.workspace.getConfiguration('calva.statusColor');

    let current = state.deref(),
        doc = util.getDocument({}),
        fileType = util.getFileType(doc),
        cljsBuild = current.get('cljsBuild');

    //let disconnectedColor = "rgb(192,192,192)";

    const pprint = state.config().pprint;
    prettyPrintToggle.text = "pprint";
    prettyPrintToggle.color = pprint ? color.active : color.inactive;
    prettyPrintToggle.tooltip = `Turn pretty printing ${pprint ? 'off' : 'on'}`
    prettyPrintToggle.command = "calva.togglePrettyPrint"

    typeStatus.command = null;
    typeStatus.text = "Disconnected";
    typeStatus.tooltip = "No active REPL session";
    typeStatus.color = colorValue("disconnectedColor", currentConf);

    connectionStatus.command = null;
    connectionStatus.tooltip = "REPL connection status";

    cljsBuildStatus.text = null;
    cljsBuildStatus.command = "calva.switchCljsBuild";
    cljsBuildStatus.tooltip = null;

    if (current.get('connected')) {
        connectionStatus.text = "nREPL $(zap)";
        connectionStatus.color = colorValue("connectedSatusColor", currentConf);
        connectionStatus.tooltip = `nrepl://${current.get('hostname')}:${current.get('port')} (Click to reset connection)`;
        connectionStatus.command = "calva.jackInOrConnect";
        typeStatus.color = colorValue("typeStatusColor", currentConf);
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
    } else if (util.getLaunchingState()) {
        connectionStatus.color = colorValue("launchingColor", currentConf);
        connectionStatus.text = "Launching REPL using " + util.getLaunchingState();
        connectionStatus.tooltip = "Click to interrupt jack-in or Connect to REPL Server";
        connectionStatus.command = "calva.disconnect";
    } else if (util.getConnectingState()) {
        connectionStatus.text = "nREPL - trying to connect";
        connectionStatus.tooltip = "Click to interrupt jack-in or Connect to REPL Server";
        connectionStatus.command = "calva.disconnect";
    } else {
        connectionStatus.text = "nREPL $(zap)";
        connectionStatus.tooltip = "Click to jack-in or Connect to REPL Server";
        connectionStatus.color = colorValue("disconnectedColor", currentConf);
        connectionStatus.command = "calva.jackInOrConnect";
    }

    connectionStatus.show();
    typeStatus.show();
    if (cljsBuildStatus.text) {
        cljsBuildStatus.show();
    } else {
        cljsBuildStatus.hide();
    }
    prettyPrintToggle.show();
}

export default {
    update,
    color
};
