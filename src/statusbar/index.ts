import { StatusBarAlignment } from "vscode";
import { FileTypeStatusBarItem } from "./file-type";
import { PrettyPrintStatusBarItem } from "./pretty-print";
import { CljsBuildStatusBarItem } from "./cljs-build";
import { ConnectionStatusBarItem } from "./connection";

const statusBarItems = [];

function init(): any[] {
    statusBarItems.push(new ConnectionStatusBarItem(StatusBarAlignment.Left));
    statusBarItems.push(new FileTypeStatusBarItem(StatusBarAlignment.Left));
    statusBarItems.push(new CljsBuildStatusBarItem(StatusBarAlignment.Left));
    statusBarItems.push(new PrettyPrintStatusBarItem(StatusBarAlignment.Right));
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
