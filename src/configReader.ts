import { workspace, WorkspaceConfiguration } from 'vscode';

export interface ColorsConfig {
    disconnected: string,
    launching: string,
    connected: string,
    typeStatus: string,
    active: string,
    inactive: string,
    error: string
}

export class ConfigReader {
    private changeEventDisposable;
    constructor() {
        this.changeEventDisposable = workspace.onDidChangeConfiguration(configChange => {
            if(configChange.affectsConfiguration("calva.statusColor")){
                this._colors = this.readColorConfig();
            }
        });
    }

    private _colors: ColorsConfig;

    get colors() {
        if(this._colors === undefined){
            this._colors = this.readColorConfig();
        }
        return this._colors;
    }

    private readColorConfig(): ColorsConfig {
        let colorConfig = workspace.getConfiguration('calva.statusColor');
        return {
            disconnected: this.colorValue("disconnectedColor", colorConfig),
            launching: this.colorValue("launchingColor", colorConfig),
            // TODO: Fix config typo
            connected: this.colorValue("connectedSatusColor", colorConfig),
            typeStatus: this.colorValue("typeStatusColor", colorConfig),
            // TODO: Create config entries
            active: "white",
            inactive: "#b3b3b3",
            error: "#FF2D00"
        }
    }

    private colorValue(section: string, currentConf: WorkspaceConfiguration):string {
        let { defaultValue, globalValue, workspaceFolderValue, workspaceValue} = currentConf.inspect(section);
        return workspaceFolderValue || workspaceValue || globalValue || defaultValue;
    }

    dispose() {
        this.changeEventDisposable.dispose();
    }
}

// TODO: This should be somewhere else
const configReader = new ConfigReader();
export default configReader;
