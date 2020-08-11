import * as vscode from 'vscode';
import * as state from './state';
import * as util from './utilities';
import type { ReplType } from './config';
import { isResultsDoc, getSessionType, getPrompt, append } from './result-output';

let historyIndex = null;
let lastTextAtPrompt = null;

function reset(): void {
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
        reset();
    }
}

function clearHistory(replType: ReplType) {
    state.extensionContext.workspaceState.update(replType + "-history", []);
}

function showReplHistoryEntry(historyEntry: string, resultsEditor: vscode.TextEditor): void {
    const prompt = getPrompt();
    const resultsDoc = resultsEditor.document;
    const docText = resultsDoc.getText();
    const indexOfLastPrompt = docText.lastIndexOf(prompt);
    if (indexOfLastPrompt === -1) {
        // Prompt not found in results doc, so append a prompt and re-run this function
        append(getPrompt(), _ => {
            showReplHistoryEntry(historyEntry, resultsEditor);
        });
        return;
    }
    let insertOffset = indexOfLastPrompt + prompt.length;
    const startPosition = resultsDoc.positionAt(insertOffset);
    const range = new vscode.Range(startPosition, resultsDoc.positionAt(Infinity));
    const entry = historyEntry || "\n";
    const edit = new vscode.WorkspaceEdit();
    edit.replace(resultsDoc.uri, range, entry);
    vscode.workspace.applyEdit(edit).then(_ => {
        resultsDoc.save();
        util.scrollToBottom(resultsEditor);
    });
}

function saveTextAtPrompt(docText: string): void {
    const prompt = getPrompt();
    const indexOfLastPrompt = docText.lastIndexOf(prompt);
    if (indexOfLastPrompt === -1) {
        return;
    }
    const indexOfEndOfPrompt = indexOfLastPrompt + prompt.length;
    lastTextAtPrompt = docText.substring(indexOfEndOfPrompt);
}

function addNewline(text: string) {
    return `\n${text}`;
}

function showPreviousReplHistoryEntry(): void {
    const editor = vscode.window.activeTextEditor;
    const doc = editor.document;
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
    showReplHistoryEntry(addNewline(history[historyIndex]), editor);
}

function showNextReplHistoryEntry(): void {
    const editor = vscode.window.activeTextEditor;
    const doc = editor.document;
    const replType = getSessionType();
    const history = getHistory(replType);
    if (!isResultsDoc(doc) || historyIndex === null) {
        return;
    }
    historyIndex++;
    if (historyIndex >= history.length) {
        historyIndex = null;
        showReplHistoryEntry(lastTextAtPrompt, editor);
    } else {
        showReplHistoryEntry(addNewline(history[historyIndex]), editor);
    }
}

export {
    addToHistory,
    showPreviousReplHistoryEntry,
    showNextReplHistoryEntry,
    reset
};
