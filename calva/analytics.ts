import * as vscode from 'vscode';
import * as UA from 'universal-analytics';
import * as uuid from "uuid/v4";

export default class Analytics {
    private visitor: UA.Visitor;
    private extensionId: string;
    private extensionVersion: string;
    private store: vscode.Memento;

    constructor(context: vscode.ExtensionContext) {
        this.extensionId = "cospaia.clojure4vscode";
        const extension = vscode.extensions.getExtension(this.extensionId)!;
        this.extensionVersion = extension.packageJSON.version;
        this.store = context.globalState;

        if (this.userOptedIn()) {
            this.visitor = UA('UA-69796730-3', this.userID());
        }
    }

    private userOptedIn(): boolean {
        const config = vscode.workspace.getConfiguration('telemetry');
        return config.get<boolean>('enableTelemetry', false);
    }

    private userID(): string {
        const KEY = 'userLogID';
        if (this.store.get(KEY) != undefined) {
            this.store.update(KEY, uuid())
        }
        return this.store.get(KEY)
    }

    logCalvaStart() {
        if (this.userOptedIn()) {
            this.visitor.pageview('/', (error, count) => {
                console.log("Error logging '/': ", error, count)
            });
        }
    }
}

// export default class Usage {

//     static init(context: vscode.ExtensionContext) {
//         const extensionId = "cospaia.clojure4vscode";
//         const extension = vscode.extensions.getExtension(extensionId)!;
//         const extensionVersion = extension.packageJSON.version;
//         const ua = Buffer.from("YmRkNWIxOTMtZmVhMi00MDJiLTg3MDEtN2Y4MzZiMzYyN2MyCg==", "base64").toString();
//         Telemetry.reporter = new TelemetryReporter(extensionId, extensionVersion, voluntaryJoe);
//     }

//     static log(...args) {
//         if (Telemetry.reporter !== null) {
//             console.log("Telemetry log: ", ...args);
//             Telemetry.reporter.sendTelemetryEvent.apply(arguments);
//         } else {
//             console.error("Telemetry log denied: reporter not initialized");
//         }
//     }

//     static dispose() {
//         if (Telemetry.reporter !== null) {
//             Telemetry.reporter.dispose();
//         } else {
//             console.error("No telemetry dispose for you: reporter not initialized");
//         }
//     }
// }
