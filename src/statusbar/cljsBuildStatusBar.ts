import { window, StatusBarAlignment, StatusBarItem } from "vscode";
import * as state from '../state';
import * as util from '../utilities';

export class CljsBuildStatusBar {
    private statusBarItem: StatusBarItem;
    constructor(alignment: StatusBarAlignment) {
        this.statusBarItem = window.createStatusBarItem(alignment);
        this.statusBarItem.command = "calva.switchCljsBuild";
    }

    update() {
        const current = state.deref();
        const cljsBuild = current.get('cljsBuild');
        const connected = current.get("connected");
        const sessionType = util.getREPLSessionType();

        let text = null;
        let tooltip = null;

        if(connected && sessionType === 'cljs' && state.extensionContext.workspaceState.get('cljsReplTypeHasBuilds')) {
            if (cljsBuild !== null) {
                this.statusBarItem.text = cljsBuild;
                this.statusBarItem.tooltip = "Click to switch CLJS build REPL";
            } else {
                this.statusBarItem.text = "no build connected"
                this.statusBarItem.tooltip = "Click to connect to a CLJS build REPL";
            }
        }

        this.statusBarItem.text = text;
        this.statusBarItem.tooltip = tooltip;

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
