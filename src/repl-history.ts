import * as vscode from 'vscode';
import * as state from './state';
import { ReplType } from './config';

function getHistory(replType: ReplType): Array<string> {
    let history = (state.extensionContext.workspaceState.get(replType + "-history") || []) as Array<string>;
    return history;
}

function addToHistory(replType: ReplType, line: string) {
    let entry = line.trim();
    if (line !== "") {
        let history = (state.extensionContext.workspaceState.get(replType+ "-history") || []) as Array<string>;
        let last = "";
        if (history.length > 0) {
            last = history[history.length - 1];
        }
        if (last !== line) {
            history.push(entry);
            state.extensionContext.workspaceState.update(this.type + "-history", history);
        }
    }
}

function clearHistory(replType: ReplType) {
    state.extensionContext.workspaceState.update(replType + "-history", []);
}

function showPreviousReplHistoryEntryInEditor(): void {
}


export {
    addToHistory,
    showPreviousReplHistoryEntryInEditor
};
