import * as vscode from 'vscode';
import * as state from './state';
import { ReplType } from './config';
import { isResultsDoc, getSessionType } from './result-output';

let historyIndex = -1;

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
    historyIndex = history.length - 1;
}

function clearHistory(replType: ReplType) {
    state.extensionContext.workspaceState.update(replType + "-history", []);
}

function showPreviousReplHistoryEntryInEditor(): void {
    const editor = vscode.window.activeTextEditor;
    const doc = editor.document;
    if (isResultsDoc(doc)) {
        if (historyIndex === -1) {
            return;
        }
        historyIndex--;
        const history = getHistory(getSessionType());
        const previousEntry = history[historyIndex] || "";
    }
}


export {
    addToHistory,
    showPreviousReplHistoryEntryInEditor
};
