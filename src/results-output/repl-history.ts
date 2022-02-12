import * as vscode from 'vscode';
import * as state from '../state';
import * as util from '../utilities';
import {
    getIndexAfterLastNonWhitespace,
    getTextAfterLastOccurrenceOfSubstring,
} from '../util/string';
import type { ReplSessionType } from '../config';
import { isResultsDoc, getSessionType, getPrompt, append } from './results-doc';
import { addToHistory } from './util';

const replHistoryCommandsActiveContext = 'calva:replHistoryCommandsActive';
let historyIndex = null;
let lastTextAtPrompt = null;

function setReplHistoryCommandsActiveContext(editor: vscode.TextEditor): void {
    if (editor && util.getConnectedState() && isResultsDoc(editor.document)) {
        const document = editor.document;
        const selection = editor.selection;
        const positionAtEndOfContent = document.positionAt(
            getIndexAfterLastNonWhitespace(document.getText())
        );
        if (selection.start.isAfterOrEqual(positionAtEndOfContent)) {
            vscode.commands.executeCommand(
                'setContext',
                replHistoryCommandsActiveContext,
                true
            );
            return;
        }
    }
    vscode.commands.executeCommand(
        'setContext',
        replHistoryCommandsActiveContext,
        false
    );
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
    const history = state.extensionContext.workspaceState.get(key, []);
    return history;
}

function updateReplHistory(
    replSessionType: ReplSessionType,
    history: string[],
    content: string,
    index: number
) {
    const newHistory = [...history];
    newHistory[index] = content.trim();
    state.extensionContext.workspaceState.update(
        getHistoryKey(replSessionType),
        newHistory
    );
}

function addToReplHistory(replSessionType: ReplSessionType, content: string) {
    const newHistory = addToHistory(getHistory(replSessionType), content);
    state.extensionContext.workspaceState.update(
        getHistoryKey(replSessionType),
        newHistory
    );
}

function clearHistory() {
    const replType = getSessionType();
    const key = getHistoryKey(replType);
    state.extensionContext.workspaceState.update(key, []);
    resetState();
    append('; REPL history cleared');
    append(getPrompt());
}

function showReplHistoryEntry(
    historyEntry: string,
    resultsEditor: vscode.TextEditor
): void {
    const prompt = getPrompt();
    const resultsDoc = resultsEditor.document;
    const docText = resultsDoc.getText();
    const indexOfLastPrompt = docText.lastIndexOf(prompt);
    if (indexOfLastPrompt === -1) {
        // Prompt not found in results doc, so append a prompt and re-run this function
        append(getPrompt(), (_) => {
            showReplHistoryEntry(historyEntry, resultsEditor);
        });
        return;
    }
    const insertOffset = indexOfLastPrompt + prompt.length;
    const startPosition = resultsDoc.positionAt(insertOffset);
    const range = new vscode.Range(
        startPosition,
        resultsDoc.positionAt(Infinity)
    );
    const entry = historyEntry || '\n';
    const edit = new vscode.WorkspaceEdit();
    edit.replace(resultsDoc.uri, range, entry);
    vscode.workspace.applyEdit(edit).then((_) => {
        resultsDoc.save();
        util.scrollToBottom(resultsEditor);
    });
}

function prependNewline(text: string) {
    return `\n${text}`;
}

function showPreviousReplHistoryEntry(): void {
    const editor = vscode.window.activeTextEditor;
    const doc = editor.document;
    const replSessionType = getSessionType();
    const history = getHistory(replSessionType);
    if (!isResultsDoc(doc) || historyIndex === 0 || history.length === 0) {
        return;
    }
    const textAtPrompt = getTextAfterLastOccurrenceOfSubstring(
        doc.getText(),
        getPrompt()
    );
    if (historyIndex === null) {
        historyIndex = history.length;
        lastTextAtPrompt = textAtPrompt;
    } else {
        updateReplHistory(replSessionType, history, textAtPrompt, historyIndex);
    }
    historyIndex--;
    showReplHistoryEntry(prependNewline(history[historyIndex]), editor);
}

function showNextReplHistoryEntry(): void {
    const editor = vscode.window.activeTextEditor;
    const doc = editor.document;
    const replSessionType = getSessionType();
    const history = getHistory(replSessionType);
    if (!isResultsDoc(doc) || historyIndex === null) {
        return;
    }
    if (historyIndex === history.length - 1) {
        historyIndex = null;
        showReplHistoryEntry(lastTextAtPrompt, editor);
    } else {
        const textAtPrompt = getTextAfterLastOccurrenceOfSubstring(
            doc.getText(),
            getPrompt()
        );
        updateReplHistory(replSessionType, history, textAtPrompt, historyIndex);
        historyIndex++;
        const nextHistoryEntry = history[historyIndex];
        showReplHistoryEntry(prependNewline(nextHistoryEntry), editor);
    }
}

export {
    addToHistory,
    addToReplHistory,
    showPreviousReplHistoryEntry,
    showNextReplHistoryEntry,
    resetState,
    clearHistory,
    setReplHistoryCommandsActiveContext,
};
