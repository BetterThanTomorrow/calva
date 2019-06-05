import * as vscode from 'vscode';

function readConfiguration() {
    let workspaceConfig = vscode.workspace.getConfiguration("calva.fmt");
    return {
        "format-as-you-type": workspaceConfig.get("formatAsYouType"),
        "indentation?": workspaceConfig.get("indentation"),
        "remove-surrounding-whitespace?": workspaceConfig.get("removeSurroundingWhitespace"),
        "remove-trailing-whitespace?": workspaceConfig.get("removeTrailingWhitespace"),
        "insert-missing-whitespace?": workspaceConfig.get("insertMissingWhitespace"),
        "remove-consecutive-blank-lines?": workspaceConfig.get("removeConsecutiveBlankLines"),
        "align-associative?": workspaceConfig.get("allgnMapItems")
    };
}

export function getConfig() {
    let config = readConfiguration();
    return config;
}
