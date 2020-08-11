import * as vscode from 'vscode';
import * as state from './state';
import { ReplType } from './config';
import { isResultsDoc, getSessionType, getPrompt } from './result-output';

let historyIndex = null;

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
        historyIndex = null;
    }
}

function clearHistory(replType: ReplType) {
    state.extensionContext.workspaceState.update(replType + "-history", []);
}

function showReplHistoryEntry(historyEntry: string, resultsDoc: vscode.TextDocument): void {
    const prompt = getPrompt();
    const docText = resultsDoc.getText();
    const lastIndexOfPrompt = docText.lastIndexOf(prompt);
    const indexOfEndOfPrompt = lastIndexOfPrompt + prompt.length;
    const startPosition = resultsDoc.positionAt(indexOfEndOfPrompt);
    const range = new vscode.Range(startPosition, resultsDoc.positionAt(Infinity));
    const entry = historyEntry || "";
    const edit = new vscode.WorkspaceEdit();
    const editText = `\n${entry}`;
    edit.replace(resultsDoc.uri, range, editText);
    vscode.workspace.applyEdit(edit);
}

function showPreviousReplHistoryEntry(): void {
    const doc = vscode.window.activeTextEditor.document;
    if (!isResultsDoc(doc) || historyIndex === 0) {
        return;
    }
    const replType = getSessionType();
    const history = getHistory(replType);
    if (!historyIndex) {
        historyIndex = history.length;
    }
    historyIndex--;
    showReplHistoryEntry(history[historyIndex], doc);
}

function showNextReplHistoryEntry(): void {
    const doc = vscode.window.activeTextEditor.document;
    const replType = getSessionType();
    const history = getHistory(replType);
    if (!isResultsDoc(doc) || !historyIndex || historyIndex === history.length - 1) {
        return;
    }
    historyIndex++;
    showReplHistoryEntry(history[historyIndex], doc);
}

export {
    addToHistory,
    showPreviousReplHistoryEntry,
    showNextReplHistoryEntry,
};
