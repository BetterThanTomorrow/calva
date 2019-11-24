import { StatusBarAlignment } from "vscode";
import { TypeStatusBar } from "./typeStatusBar";
import { PrettyPrintStatusBar } from "./prettyPrintStatusBar";
import { CljsBuildStatusBar } from "./cljsBuildStatusBar";
import { ConnectionStatusBar } from "./connectionStatusBar";

const statusBarItems = [];

function init(): any[] {
    statusBarItems.push(new ConnectionStatusBar(StatusBarAlignment.Left));
    statusBarItems.push(new TypeStatusBar(StatusBarAlignment.Left));
    statusBarItems.push(new CljsBuildStatusBar(StatusBarAlignment.Left));
    statusBarItems.push(new PrettyPrintStatusBar(StatusBarAlignment.Right));
    update();
    return statusBarItems;
}

function update() {
    statusBarItems.forEach(sbi => sbi.update());
}

export default {
    init,
    update
}
