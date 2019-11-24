import { TypeStatusBar } from "./typeStatusBar";
import { PrettyPrintStatusBar } from "./prettyPrintStatusBar";
import { CljsBuildStatusBar } from "./cljsBuildStatusBar";
import { ConnectionStatusBar } from "./connectionStatusBar";

const connectionStatus = new ConnectionStatusBar();
const typeStatus = new TypeStatusBar();
const cljsBuildStatus = new CljsBuildStatusBar();
const prettyPrintToggle = new PrettyPrintStatusBar();

function update() {
    connectionStatus.update();
    connectionStatus.show();

    typeStatus.update();
    typeStatus.show();

    cljsBuildStatus.update();

    prettyPrintToggle.update();
    prettyPrintToggle.show();
}

export default {
    update
}
