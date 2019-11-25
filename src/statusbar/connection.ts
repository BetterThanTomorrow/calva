import { window, StatusBarAlignment, StatusBarItem } from "vscode";
import configReader from "../configReader";
import * as state from '../state';
import * as util from '../utilities';

export class ConnectionStatusBarItem {
    private statusBarItem: StatusBarItem;

    constructor(alignment: StatusBarAlignment) {
        this.statusBarItem = window.createStatusBarItem(alignment);
    }

    update() {
        let current = state.deref();
        const colors = configReader.colors;

        let text = "nREPL $(zap)";
        let tooltip = "Click to jack-in or connect";
        let command = "calva.jackInOrConnect";
        let color = colors.disconnected;

        if (current.get('connected')) {
            text = "nREPL $(zap)";
            color = colors.connected;
            tooltip = `nrepl://${current.get('hostname')}:${current.get('port')} (Click to reset connection)`;
        } else if (util.getLaunchingState()) {
            color = colors.launching;
            text = "Launching REPL using " + util.getLaunchingState();
            tooltip = "Click to interrupt jack-in or Connect to REPL Server";
            command = "calva.disconnect";
        } else if (util.getConnectingState()) {
            color = colors.launching;
            text = "nREPL - trying to connect";
            tooltip = "Click to interrupt jack-in or Connect to REPL Server";
            command = "calva.disconnect";
        }

        this.statusBarItem.text = text;
        this.statusBarItem.tooltip = tooltip;
        this.statusBarItem.command = command;
        this.statusBarItem.color = color;

        this.statusBarItem.show();
    }

    dispose() {
        this.statusBarItem.dispose();
    }
}
