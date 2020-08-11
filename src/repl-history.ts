import * as vscode from 'vscode';
import * as state from './state';
import { ReplType } from './config';
import { isResultsDoc, getSessionType, getPrompt } from './result-output';

const historyIndexes = {};

function initializeReplHistory(): void {
    historyIndexes['clj'] = getHistory('clj').length;
    historyIndexes['cljs'] = getHistory('cljs').length;
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
        historyIndexes[replType] = history.length;
    }
}

function clearHistory(replType: ReplType) {
    state.extensionContext.workspaceState.update(replType + "-history", []);
}

function showPreviousReplHistoryEntryInEditor(): void {
    const doc = vscode.window.activeTextEditor.document;
    const replType = getSessionType();
    const history = getHistory(replType);
    let historyIndex = historyIndexes[replType];

    if (!isResultsDoc(doc) || historyIndex < 0) {
        return;
    }

    const prompt = getPrompt();
    const docText = doc.getText();
    const lastIndexOfPrompt = docText.lastIndexOf(prompt);
    const indexOfEndOfPrompt = lastIndexOfPrompt + prompt.length;

    if (historyIndex === history.length) {
        // User is beginning a traversal up from the most recent item. We need to save their current work at the prompt.
        const textAfterPrompt = docText.substring(indexOfEndOfPrompt);
        addToHistory(replType, textAfterPrompt);
        historyIndex--;
    }
    historyIndex--;
    const previousEntry = history[historyIndex] || "";
    const edit = new vscode.WorkspaceEdit();
    // edit.insert(doc.uri, doc.positionAt(Infinity), previousEntry);
    // vscode.workspace.applyEdit(edit);

    const position = doc.positionAt(indexOfEndOfPrompt);

    console.log(position);
}

export {
    addToHistory,
    showPreviousReplHistoryEntryInEditor,
    initializeReplHistory
};
