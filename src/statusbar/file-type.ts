import { window, StatusBarAlignment, StatusBarItem } from "vscode";
import { activeReplWindow } from '../repl-window';
import configReader from "../configReader";
import * as state from '../state';
import * as util from '../utilities';

export class FileTypeStatusBarItem {
    private statusBarItem: StatusBarItem;
    constructor(alignment: StatusBarAlignment) {
        this.statusBarItem = window.createStatusBarItem(alignment);
    }

    update() {
        const connected = state.deref().get("connected");
        const doc = util.getDocument({});
        const fileType = util.getFileType(doc);
        const sessionType = util.getREPLSessionType();

        let command = null;
        let text = "Disconnected";
        let tooltip = "No active REPL session";
        let color = configReader.colors.disconnected;

        if(connected) {
            if (fileType == 'cljc' && sessionType !== null && !activeReplWindow()) {
                text = "cljc/" + sessionType;
                if (util.getSession('clj') !== null && util.getSession('cljs') !== null) {
                    command = "calva.toggleCLJCSession";
                    tooltip = `Click to use ${(sessionType === 'clj' ? 'cljs' : 'clj')} REPL for cljc`;
                }
            } else if (sessionType === 'cljs') {
                text = "cljs";
                tooltip = "Connected to ClojureScript REPL";
            } else if (sessionType === 'clj') {
                text = "clj";
                tooltip = "Connected to Clojure REPL";
            }
            color = configReader.colors.typeStatus;
        }

        this.statusBarItem.command = command;
        this.statusBarItem.text = text;
        this.statusBarItem.tooltip = tooltip;
        this.statusBarItem.color = color
        this.statusBarItem.show();
    }

    dispose() {
        this.statusBarItem.dispose();
    }
}
