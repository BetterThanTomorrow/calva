import * as vscode from 'vscode';
import * as UA from 'universal-analytics';
import * as uuid from "uuid/v4";

function userAllowsTelemetry(): boolean {
    const config = vscode.workspace.getConfiguration('telemetry');
    return config.get<boolean>('enableTelemetry', false);
}

export default class Analytics {
    private visitor: UA.Visitor;
    private extensionId: string;
    private extensionVersion: string;
    private store: vscode.Memento;
    private GA_ID = (process.env.CALVA_DEV_GA ? process.env.CALVA_DEV_GA : 'FUBAR-69796730-3').replace(/^FUBAR/, "UA");

    constructor(context: vscode.ExtensionContext) {
        this.extensionId = "cospaia.clojure4vscode";
        const extension = vscode.extensions.getExtension(this.extensionId)!;
        this.extensionVersion = extension.packageJSON.version;
        this.store = context.globalState;

        this.visitor = UA(this.GA_ID, this.userID());
    }

    private userID(): string {
        const KEY = 'userLogID';
        if (this.store.get(KEY) == undefined) {
            const newID = uuid();
            this.store.update(KEY, newID)
            return newID;
        } else {
            return this.store.get(KEY);
        }
    }
    
    private getVisitor(): UA.Visitor | { pageview, event, screenview } {
        const noop = {
            send: function () {
                //console.log("Not logging!");
            }
        }
        if (userAllowsTelemetry()) {
            return this.visitor;
        } else {
            return {
                pageview: function (...args) { return noop },
                event: function (...args) { return noop },
                screenview: function (...args) { return noop }
            }
        }
    }
        
    logPath(path: string) {
        this.getVisitor().pageview(path).send();
    }
        
    logView(view: string) {
        this.getVisitor().screenview(view, "Calva", this.extensionVersion, this.extensionVersion).send();
    }
    
    logEvent(category: string, action: string, label?: string, value?:string ) {
        this.getVisitor().event({ ec: category, ea: action, el: label, ev: value }).send();
    }
}
