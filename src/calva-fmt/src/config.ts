import * as vscode from 'vscode';
import * as filesCache from '../../files-cache';
import { cljfmtOptions } from '../../../out/cljs-lib/cljs-lib';

function readConfiguration() {
    let workspaceConfig = vscode.workspace.getConfiguration("calva.fmt");
    const cljfmtContent = filesCache.content(workspaceConfig.get("configPath"));
    return {
        "format-as-you-type": workspaceConfig.get("formatAsYouType") as boolean,
        "cljfmt-string": cljfmtContent,
        "cljfmt-options": cljfmtOptions(cljfmtContent),
    };
}

export function getConfig() {
    let config = readConfiguration();
    return config;
}
