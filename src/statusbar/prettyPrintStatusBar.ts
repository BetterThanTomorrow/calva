import { window, StatusBarAlignment, StatusBarItem } from "vscode";
import configReader from "../configReader";
import * as state from '../state';

export class PrettyPrintStatusBar {
    private statusBarItem: StatusBarItem;
    constructor() {
        this.statusBarItem = this.createStatusBarItem();
        this.update();
    }

    private createStatusBarItem() {
        let sbi = window.createStatusBarItem(StatusBarAlignment.Right);
        sbi.command = "calva.togglePrettyPrint";
        sbi.text = "pprint";
        return sbi;
    }

    show = () => this.statusBarItem.show();

    update() {
        const color = configReader.colors;
        const pprint = state.config().prettyPrintingOptions.enabled;
        this.statusBarItem.tooltip = `Turn pretty printing ${pprint ? 'off' : 'on'}`;
        this.statusBarItem.color = pprint ? color.active : color.inactive;
    }

    dispose() {
        this.statusBarItem.dispose();
    }
}
