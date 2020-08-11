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
        historyIndex = -1;
    }
}

function clearHistory(replType: ReplType) {
    state.extensionContext.workspaceState.update(replType + "-history", []);
}

function showPreviousReplHistoryEntry(): void {
    const doc = vscode.window.activeTextEditor.document;
    if (!isResultsDoc(doc) || historyIndex === 0) {
        return;
    }
    const replType = getSessionType();
    const history = getHistory(replType);
    if (historyIndex < 0) {
        historyIndex = history.length;
    }
    historyIndex--;
    const prompt = getPrompt();
    const docText = doc.getText();
    const lastIndexOfPrompt = docText.lastIndexOf(prompt);
    const indexOfEndOfPrompt = lastIndexOfPrompt + prompt.length;
    const startPosition = doc.positionAt(indexOfEndOfPrompt);
    const range = new vscode.Range(startPosition, doc.positionAt(Infinity));
    const previousEntry = history[historyIndex] || "";
    const edit = new vscode.WorkspaceEdit();
    const editText = `\n${previousEntry}`;
    edit.replace(doc.uri, range, editText);
    vscode.workspace.applyEdit(edit);
}

function showNextReplHistoryEntry(): void {
    const doc = vscode.window.activeTextEditor.document;
    const replType = getSessionType();
    const history = getHistory(replType);
    if (!isResultsDoc(doc) || historyIndex === history.length - 1) {
        return;
    }
    
}

export {
    addToHistory,
    showPreviousReplHistoryEntry,
    showNextReplHistoryEntry,
};
