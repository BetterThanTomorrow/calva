import * as vscode from 'vscode';
import * as state from './state';
import * as util from './utilities';
import type { ReplSessionType } from './config';
import { isResultsDoc, getSessionType, getPrompt, append } from './result-output';

const replHistoryCommandsActiveContext = "calva:replHistoryCommandsActive";
let historyIndex = null;
let lastTextAtPrompt = null;

// UNIT TEST
function getIndexAfterLastNoneWhitespace(text: string): number {
    const textTrimmed = text.trim();
    const lastNonWhitespaceOrEolChar = textTrimmed[textTrimmed.length - 1];
    return text.lastIndexOf(lastNonWhitespaceOrEolChar) + 1;
}

function setReplHistoryCommandsActiveContext(editor: vscode.TextEditor): void {
    const document = editor.document;
    if (util.getConnectedState() && isResultsDoc(document)) {
        const selection = editor.selection;
        const positionAtEndOfContent = document.positionAt(getIndexAfterLastNoneWhitespace(document.getText()));
        if (selection.start.isAfterOrEqual(positionAtEndOfContent)) {
            vscode.commands.executeCommand("setContext", replHistoryCommandsActiveContext, true);
            return;
        }
    }
    vscode.commands.executeCommand("setContext", replHistoryCommandsActiveContext, false);
}

function resetState(): void {
    historyIndex = null;
    lastTextAtPrompt = null;
}

function getHistoryKey(replSessionType: ReplSessionType): string {
    return `calva-repl-${replSessionType}-history`;
}

function getHistory(replSessionType: ReplSessionType): Array<string> {
    const key = getHistoryKey(replSessionType);
    let history = state.extensionContext.workspaceState.get(key, []);
    return history;
}

// UNIT TEST
function addToHistory(history: string[], content: string): string[] {
    const entry = content.trim();
    if (content !== "") {
        let last = "";
        if (history.length > 0) {
            last = history[history.length - 1];
        }
        if (last !== entry) {
            history.push(entry);
        }
    }
    return history;
}

function addToReplHistory(replSessionType: ReplSessionType, content: string) {
    const newHistory = addToHistory(getHistory(replSessionType), content);
    state.extensionContext.workspaceState.update(getHistoryKey(replSessionType), newHistory);
}

function clearHistory() {
    const replType = getSessionType();
    const key = getHistoryKey(replType);
    state.extensionContext.workspaceState.update(key, []);
    resetState();
    append('; REPL history cleared');
    append(getPrompt());
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

function prependNewline(text: string) {
    return `\n${text}`;
}

function showPreviousReplHistoryEntry(): void {
    const editor = vscode.window.activeTextEditor;
    const doc = editor.document;
    const replType = getSessionType();
    const history = getHistory(replType);
    if (!isResultsDoc(doc) || historyIndex === 0 || history.length === 0) {
        return;
    }
    if (historyIndex === null) {
        historyIndex = history.length;
    }
    if (historyIndex === history.length) {
        saveTextAtPrompt(doc.getText());
    }
    historyIndex--;
    showReplHistoryEntry(prependNewline(history[historyIndex]), editor);
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
        showReplHistoryEntry(prependNewline(history[historyIndex]), editor);
    }
}

export {
    addToReplHistory,
    showPreviousReplHistoryEntry,
    showNextReplHistoryEntry,
    resetState,
    clearHistory,
    setReplHistoryCommandsActiveContext
};
