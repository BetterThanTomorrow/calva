import * as vscode from 'vscode';
import * as state from './state';
import { ReplType } from './config';
import { isResultsDoc, getSessionType, getPrompt } from './result-output';

let historyIndex = -1;

function getHistory(replType: ReplType): Array<string> {
    let history = (state.extensionContext.workspaceState.get(replType + "-history") || []) as Array<string>;
    return history;
}

function addToHistory(replType: ReplType, line: string) {
    const entry = line.trim();
    if (line !== "") {
        const history = (state.extensionContext.workspaceState.get(replType + "-history") || []) as Array<string>;
        let last = "";
        if (history.length > 0) {
            last = history[history.length - 1];
        }
        if (last !== line) {
            history.push(entry);
            state.extensionContext.workspaceState.update(replType + "-history", history);
        }
        historyIndex = history.length;
    }
}

function clearHistory(replType: ReplType) {
    state.extensionContext.workspaceState.update(replType + "-history", []);
}

function showPreviousReplHistoryEntryInEditor(): void {
    const editor = vscode.window.activeTextEditor;
    const doc = editor.document;
    historyIndex--;
    if (!isResultsDoc(doc) || historyIndex < 0) {
        return;
    }
    const history = getHistory(getSessionType());
    const previousEntry = history[historyIndex] || "";
    const edit = new vscode.WorkspaceEdit();
    // edit.insert(doc.uri, doc.positionAt(Infinity), previousEntry);
    // vscode.workspace.applyEdit(edit);

    const prompt = getPrompt();
    const docText = doc.getText();
    const lastIndexOfPrompt = docText.lastIndexOf(prompt);
    const position = doc.positionAt(lastIndexOfPrompt);
    console.log(position);
}

export {
    addToHistory,
    showPreviousReplHistoryEntryInEditor
};
