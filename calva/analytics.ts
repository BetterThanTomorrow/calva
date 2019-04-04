import * as vscode from 'vscode';
import ua from "universal-analytics";
import uuid from "uuid/v4"

export default class Usage {
    private static reporter: TelemetryReporter = null;
    
    static init(context: vscode.ExtensionContext) {
        const extensionId = "cospaia.clojure4vscode";
        const extension = extensions.getExtension(extensionId)!;
        const extensionVersion = extension.packageJSON.version;
        const ua = Buffer.from("YmRkNWIxOTMtZmVhMi00MDJiLTg3MDEtN2Y4MzZiMzYyN2MyCg==", "base64").toString();
        Telemetry.reporter = new TelemetryReporter(extensionId, extensionVersion, voluntaryJoe);
    }
    
    static log(...args) {
        if (Telemetry.reporter !== null) {
            console.log("Telemetry log: ", ...args);
            Telemetry.reporter.sendTelemetryEvent.apply(arguments);
        } else {
            console.error("Telemetry log denied: reporter not initialized");
        }
    }
    
    static dispose() {
        if (Telemetry.reporter !== null) {
            Telemetry.reporter.dispose();
        } else {
            console.error("No telemetry dispose for you: reporter not initialized");
        }
    }
}
