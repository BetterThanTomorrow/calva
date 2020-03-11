import * as vscode from 'vscode';
import * as filesCache from '../../files-cache';
import { cljfmtOptions } from '../../../out/cljs-lib/cljs-lib';

const defaultCljfmtContent = "\
{:remove-surrounding-whitespace? true\n\
 :remove-trailing-whitespace? true\n\
 :remove-consecutive-blank-lines? false\n\
 :insert-missing-whitespace? true\n\
 :align-associative? false}";

function readConfiguration() {
    let workspaceConfig = vscode.workspace.getConfiguration("calva.fmt");
    const cljfmtContent = filesCache.content(workspaceConfig.get("configPath"));
    return {
        "format-as-you-type": workspaceConfig.get("formatAsYouType") as boolean,
        "cljfmt-string": cljfmtContent ? cljfmtContent : defaultCljfmtContent,
        "cljfmt-options": cljfmtContent ? cljfmtOptions(cljfmtContent) : cljfmtOptions(defaultCljfmtContent)
    };
}

export function getConfig() {
    let config = readConfiguration();
    return config;
}
