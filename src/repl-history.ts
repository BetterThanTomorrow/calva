import * as vscode from 'vscode';
import * as state from './state';
import { ReplType } from './config';
import { isResultsDoc, getSessionType, getPrompt } from './result-output';

let historyIndex = null;
let lastTextAtPrompt = null;

function initializeHistory(): void {
    historyIndex = null;
    lastTextAtPrompt = null;
}

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
        lastTextAtPrompt = null;
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
    edit.replace(resultsDoc.uri, range, entry);
    vscode.workspace.applyEdit(edit);
}

function saveTextAtPrompt(docText: string): void {
    const prompt = getPrompt();
    const lastIndexOfPrompt = docText.lastIndexOf(prompt);
    if (lastIndexOfPrompt === -1) {
        return;
    }
    const indexOfEndOfPrompt = lastIndexOfPrompt + prompt.length;
    lastTextAtPrompt = docText.substring(indexOfEndOfPrompt);
}

function addNewline(text: string) {
    return `\n${text}`;
}

function showPreviousReplHistoryEntry(): void {
    const doc = vscode.window.activeTextEditor.document;
    if (!isResultsDoc(doc) || historyIndex === 0) {
        return;
    }
    const replType = getSessionType();
    const history = getHistory(replType);
    if (historyIndex === null) {
        historyIndex = history.length;
    }
    if (historyIndex === history.length) {
        saveTextAtPrompt(doc.getText());
    }
    historyIndex--;
    showReplHistoryEntry(addNewline(history[historyIndex]), doc);
}

function showNextReplHistoryEntry(): void {
    const doc = vscode.window.activeTextEditor.document;
    const replType = getSessionType();
    const history = getHistory(replType);
    if (!isResultsDoc(doc) || historyIndex === null) {
        return;
    }
    historyIndex++;
    if (historyIndex >= history.length) {
        historyIndex = null;
        showReplHistoryEntry(lastTextAtPrompt, doc);
    } else {
        showReplHistoryEntry(addNewline(history[historyIndex]), doc);
    }
}

export {
    addToHistory,
    showPreviousReplHistoryEntry,
    showNextReplHistoryEntry,
    initializeHistory
};
