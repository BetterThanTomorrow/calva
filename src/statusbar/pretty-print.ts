import { window, StatusBarAlignment, StatusBarItem } from "vscode";
import configReader from "../configReader";
import * as state from '../state';

export class PrettyPrintStatusBarItem {
    private statusBarItem: StatusBarItem;
    constructor(alignment: StatusBarAlignment) {
        this.statusBarItem = window.createStatusBarItem(alignment);
        this.statusBarItem.command = "calva.togglePrettyPrint";
        this.statusBarItem.text = "pprint";
    }

    update() {
        const color = configReader.colors;
        const pprint = state.config().prettyPrintingOptions.enabled;
        this.statusBarItem.tooltip = `Turn pretty printing ${pprint ? 'off' : 'on'}`;
        this.statusBarItem.color = pprint ? color.active : color.inactive;

        this.statusBarItem.show();
    }

    dispose() {
        this.statusBarItem.dispose();
    }
}
