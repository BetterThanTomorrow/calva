import * as vscode from 'vscode';
import * as state from '../state';
import * as util from '../utilities';
import {
  getIndexAfterLastNonWhitespace,
  getTextAfterLastOccurrenceOfSubstring,
} from '../util/string';
import type { ReplSessionType } from '../config';
import { isResultsDoc, getSessionType, getPrompt, append } from './repl-doc';
import { addToHistory } from '../results-output/util';
import { isUndefined } from 'lodash';

const replHistoryCommandsActiveContext = 'calva:replHistoryCommandsActive';
let historyIndex: number | undefined = undefined;
let lastTextAtPrompt: string | undefined = undefined;

function setReplHistoryCommandsActiveContext(editor: vscode.TextEditor): void {
  if (editor && util.getConnectedState() && isResultsDoc(editor.document)) {
    const document = editor.document;
    const selection = editor.selections[0];
    const positionAtEndOfContent = document.positionAt(
      getIndexAfterLastNonWhitespace(document.getText())
    );
    if (selection.start.isAfterOrEqual(positionAtEndOfContent)) {
      void vscode.commands.executeCommand('setContext', replHistoryCommandsActiveContext, true);
      return;
    }
  }
  void vscode.commands.executeCommand('setContext', replHistoryCommandsActiveContext, false);
}

function resetState(): void {
  historyIndex = undefined;
  lastTextAtPrompt = undefined;
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
  void state.extensionContext.workspaceState.update(getHistoryKey(replSessionType), newHistory);
}

function addToReplHistory(replSessionType: ReplSessionType, content: string) {
  const newHistory = addToHistory(getHistory(replSessionType), content);
  void state.extensionContext.workspaceState.update(getHistoryKey(replSessionType), newHistory);
}

function clearHistory() {
  const replType = getSessionType();
  const key = getHistoryKey(replType);
  void state.extensionContext.workspaceState.update(key, []);
  resetState();
  append('; REPL history cleared');
  append(getPrompt());
}

function showReplHistoryEntry(
  historyEntry: string | undefined,
  resultsEditor: vscode.TextEditor
): void {
  const prompt = promptLine();
  const resultsDoc = resultsEditor.document;
  const docText = resultsDoc.getText();
  const indexOfLastPrompt = docText.lastIndexOf(prompt);
  const insertOffset = indexOfLastPrompt === -1 ? 0 : indexOfLastPrompt + prompt.length;
  const startPosition = resultsDoc.positionAt(insertOffset);
  const range = new vscode.Range(startPosition, resultsDoc.positionAt(Infinity));
  const entry = historyEntry || '';
  const edit = new vscode.WorkspaceEdit();
  edit.replace(resultsDoc.uri, range, entry);
  void vscode.workspace.applyEdit(edit).then((_) => {
    void resultsDoc.save();
    util.scrollToBottom(resultsEditor);
  });
}

function promptLine() {
  return `${getPrompt()}\n`;
}

function showPreviousReplHistoryEntry(): void {
  const editor = util.getActiveTextEditor();
  const doc = editor.document;
  const replSessionType = getSessionType();
  const history = getHistory(replSessionType);
  if (!isResultsDoc(doc) || historyIndex === 0 || history.length === 0) {
    return;
  }
  const textAtPrompt = getTextAfterLastOccurrenceOfSubstring(doc.getText(), promptLine());
  if (isUndefined(historyIndex)) {
    historyIndex = history.length;
    lastTextAtPrompt = textAtPrompt;
  } else {
    util.assertIsDefined(textAtPrompt, 'Expected to find text at the prompt!');
    updateReplHistory(replSessionType, history, textAtPrompt, historyIndex);
  }
  historyIndex--;
  showReplHistoryEntry(history[historyIndex], editor);
}

function showNextReplHistoryEntry(): void {
  const editor = util.getActiveTextEditor();
  const doc = editor.document;
  const replSessionType = getSessionType();
  const history = getHistory(replSessionType);
  if (!isResultsDoc(doc) || historyIndex === null) {
    return;
  }
  if (historyIndex === history.length - 1) {
    historyIndex = undefined;
    showReplHistoryEntry(lastTextAtPrompt, editor);
  } else {
    const textAtPrompt = getTextAfterLastOccurrenceOfSubstring(doc.getText(), promptLine());
    util.assertIsDefined(textAtPrompt, 'Expected to find text at the prompt!');
    util.assertIsDefined(historyIndex, 'Expected a value for historyIndex!');
    updateReplHistory(replSessionType, history, textAtPrompt, historyIndex);
    historyIndex++;
    const nextHistoryEntry = history[historyIndex];
    showReplHistoryEntry(nextHistoryEntry, editor);
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
