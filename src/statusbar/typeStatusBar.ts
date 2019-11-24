import { window, StatusBarAlignment, StatusBarItem } from "vscode";
import { activeReplWindow } from '../repl-window';
import configReader from "../configReader";
import * as state from '../state';
import * as util from '../utilities';

export class TypeStatusBar {
    private statusBarItem: StatusBarItem;
    constructor() {
        this.statusBarItem = this.createStatusBarItem();
    }

    private createStatusBarItem() {
        let sbi = window.createStatusBarItem(StatusBarAlignment.Left);
        sbi.command = null;
        sbi.text = "Disconnected";
        sbi.tooltip = "No active REPL session";
        sbi.color = configReader.colors.disconnected;
        return sbi;
    }

    show = () => this.statusBarItem.show();

    update() {
        let current = state.deref(),
            doc = util.getDocument({}),
            fileType = util.getFileType(doc);

        if(current.get('connected')) {
            this.statusBarItem.color = configReader.colors.typeStatus;
            if (fileType == 'cljc' && util.getREPLSessionType() !== null && !activeReplWindow()) {
                this.statusBarItem.text = "cljc/" + util.getREPLSessionType()
                if (util.getSession('clj') !== null && util.getSession('cljs') !== null) {
                    this.statusBarItem.command = "calva.toggleCLJCSession";
                    this.statusBarItem.tooltip = `Click to use ${(util.getREPLSessionType() === 'clj' ? 'cljs' : 'clj')} REPL for cljc`;
                }
            } else if (util.getREPLSessionType() === 'cljs') {
                this.statusBarItem.text = "cljs";
                this.statusBarItem.tooltip = "Connected to ClojureScript REPL";
            } else if (util.getREPLSessionType() === 'clj') {
                this.statusBarItem.text = "clj"
                this.statusBarItem.tooltip = "Connected to Clojure REPL";
            }
        }
    }

    dispose() {
        this.statusBarItem.dispose();
    }
}
