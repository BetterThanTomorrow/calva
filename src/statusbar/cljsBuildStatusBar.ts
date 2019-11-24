import { window, StatusBarAlignment, StatusBarItem } from "vscode";
import * as state from '../state';
import * as util from '../utilities';

export class CljsBuildStatusBar {
    private statusBarItem: StatusBarItem;
    constructor() {
        this.statusBarItem = this.createStatusBarItem();
        this.update();
    }

    private createStatusBarItem() {
        let sbi = window.createStatusBarItem(StatusBarAlignment.Left);
        sbi.command = "calva.switchCljsBuild";
        sbi.text = null;
        sbi.tooltip = null;
        return sbi;
    }

    show = () => this.statusBarItem.show();

    update() {
        let current = state.deref(),
            cljsBuild = current.get('cljsBuild');

        if(current.get("connected")) {
            if (util.getREPLSessionType() === 'cljs' && state.extensionContext.workspaceState.get('cljsReplTypeHasBuilds')) {
                if (cljsBuild !== null && util.getREPLSessionType() === 'cljs') {
                    this.statusBarItem.text = cljsBuild;
                    this.statusBarItem.tooltip = "Click to switch CLJS build REPL";
                } else if (cljsBuild === null) {
                    this.statusBarItem.text = "no build connected"
                    this.statusBarItem.tooltip = "Click to connect to a CLJS build REPL";
                }
            }
        }

        if(this.statusBarItem.text) {
            this.statusBarItem.show();
        } else {
            this.statusBarItem.hide();
        }
    }

    dispose() {
        this.statusBarItem.dispose();
    }
}
