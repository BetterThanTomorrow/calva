import * as vscode from 'vscode';
import * as state from '../../state';
import { cljfmtOptions } from '../../../out/cljs-lib/cljs-lib';

function readConfiguration() {
    let workspaceConfig = vscode.workspace.getConfiguration("calva.fmt");
    const cljfmtContent = state.readFile(state.resolvePath(workspaceConfig.get("configPath")));
    return {
        "format-as-you-type": workspaceConfig.get("formatAsYouType") as boolean,
        "indentation?": workspaceConfig.get("indentation"),
        "remove-surrounding-whitespace?": workspaceConfig.get("removeSurroundingWhitespace"),
        "remove-trailing-whitespace?": workspaceConfig.get("removeTrailingWhitespace"),
        "insert-missing-whitespace?": workspaceConfig.get("insertMissingWhitespace"),
        "remove-consecutive-blank-lines?": workspaceConfig.get("removeConsecutiveBlankLines"),
        "align-associative?": workspaceConfig.get("alignMapItems"),
        "cljfmt-string": cljfmtContent,
        "cljfmt-options": cljfmtOptions(cljfmtContent),
    };
}

export function getConfig() {
    let config = readConfiguration();
    return config;
}
