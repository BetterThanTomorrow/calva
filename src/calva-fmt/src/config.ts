import * as vscode from 'vscode';
import * as filesCache from '../../files-cache';
import { read_cljfmt_js_bridge } from 'shadow-cljs/calva.fmt.formatter';

const defaultCljfmtContent = "\
{:remove-surrounding-whitespace? true\n\
 :remove-trailing-whitespace? true\n\
 :remove-consecutive-blank-lines? false\n\
 :insert-missing-whitespace? true\n\
 :align-associative? false}";

function configuration(workspaceConfig: vscode.WorkspaceConfiguration, cljfmtString: string) {
    return {
        "format-as-you-type": workspaceConfig.get("formatAsYouType") as boolean,
        "cljfmt-string": cljfmtString,
        "cljfmt-options": read_cljfmt_js_bridge(cljfmtString)
    };
}

function readConfiguration() {
    const workspaceConfig = vscode.workspace.getConfiguration("calva.fmt");
    const configPath: string = workspaceConfig.get("configPath");
    const cljfmtContent: string = filesCache.content(configPath);
    const config = configuration(workspaceConfig, cljfmtContent ? cljfmtContent : defaultCljfmtContent);
    if (!config["cljfmt-options"]["error"]) {
        return config;
    } else {
        vscode.window.showErrorMessage(`Error parsing ${configPath}: ${config["cljfmt-options"]["error"]}\n\nUsing default formatting configuration.`);
        return configuration(workspaceConfig, defaultCljfmtContent)
    }
}


export function getConfig() {
    const config = readConfiguration();
    return config;
}
