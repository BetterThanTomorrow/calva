import { window, StatusBarAlignment, StatusBarItem } from "vscode";
import { activeReplWindow } from '../repl-window';
import configReader from "../configReader";
import * as state from '../state';
import * as util from '../utilities';

export class ConnectionStatusBar {
    private statusBarItem: StatusBarItem;
    constructor() {
        this.statusBarItem = this.createStatusBarItem();
    }

    private createStatusBarItem() {
        let sbi = window.createStatusBarItem(StatusBarAlignment.Left);
        sbi.command = null;
        sbi.tooltip = "REPL connection status";
        return sbi;
    }

    show = () => this.statusBarItem.show();

    update() {
        let current = state.deref();
        const color = configReader.colors;

        if (current.get('connected')) {
            this.statusBarItem.text = "nREPL $(zap)";
            this.statusBarItem.color = color.connected;
            this.statusBarItem.tooltip = `nrepl://${current.get('hostname')}:${current.get('port')} (Click to reset connection)`;
            this.statusBarItem.command = "calva.jackInOrConnect";
        } else if (util.getLaunchingState()) {
            this.statusBarItem.color = color.launching;
            this.statusBarItem.text = "Launching REPL using " + util.getLaunchingState();
            this.statusBarItem.tooltip = "Click to interrupt jack-in or Connect to REPL Server";
            this.statusBarItem.command = "calva.disconnect";
        } else if (util.getConnectingState()) {
            this.statusBarItem.text = "nREPL - trying to connect";
            this.statusBarItem.tooltip = "Click to interrupt jack-in or Connect to REPL Server";
            this.statusBarItem.command = "calva.disconnect";
        } else {
            this.statusBarItem.text = "nREPL $(zap)";
            this.statusBarItem.tooltip = "Click to jack-in or Connect to REPL Server";
            this.statusBarItem.color = color.disconnected;
            this.statusBarItem.command = "calva.jackInOrConnect";
        }
    }

    dispose() {
        this.statusBarItem.dispose();
    }
}
