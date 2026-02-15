import * as assert from 'assert';
import * as Mocha from 'mocha';
import * as vscode from 'vscode';
import * as testUtil from './util';
import * as state from '../../../state';
import * as outputWindow from '../../../repl-window/repl-window-doc';
import * as replHistory from '../../../repl-window/repl-history';
import type { NReplSession } from '../../../nrepl';

const suiteName = 'REPL history';
const serverSessionKey = 'app.server';
const uiSessionKey = 'app.ui';
const sessionKeys = [serverSessionKey, uiSessionKey];

function historyKeyFor(sessionKey: string): string {
  return `calva-repl-${sessionKey}-history`;
}

async function clearHistoryForSessions() {
  await Promise.all(
    sessionKeys.map((key) => state.extensionContext.workspaceState.update(historyKeyFor(key), []))
  );
}

function setSessionKey(sessionKey: string) {
  const fakeSession = undefined as unknown as NReplSession;
  outputWindow.setSession(fakeSession, 'user', sessionKey);
}

async function focusReplWindow(): Promise<vscode.TextEditor> {
  const editor = await outputWindow.revealReplWindowDoc(false);
  await vscode.commands.executeCommand('cursorMove', { to: 'viewPortBottom' });
  return editor;
}

async function appendPromptForSession(sessionKey: string, editor: vscode.TextEditor) {
  setSessionKey(sessionKey);
  const beforeLength = editor.document.getText().length;
  await outputWindow.appendPrompt();
  assert.ok(editor.document.getText().length > beforeLength);
}

async function typeAtPrompt(editor: vscode.TextEditor, text: string) {
  const doc = editor.document;
  const insertPosition = doc.positionAt(doc.getText().length);
  editor.selection = new vscode.Selection(insertPosition, insertPosition);
  await editor.edit((builder) => {
    builder.insert(insertPosition, text);
  });
}

function documentEndsWith(editor: vscode.TextEditor, text: string): boolean {
  return editor.document.getText().trimEnd().endsWith(text);
}

const { before, after, beforeEach } = Mocha;

suite(`${suiteName} suite`, () => {
  before(async () => {
    testUtil.showMessage(suiteName, 'suite starting!');
    await outputWindow.initReplWindowDoc();
  });

  after(() => {
    testUtil.showMessage(suiteName, 'suite done!');
  });

  beforeEach(async () => {
    await clearHistoryForSessions();
    replHistory.resetState();
  });

  test('stores history per session key', () => {
    replHistory.addToReplHistory(serverSessionKey, '(println :srv1)');
    replHistory.addToReplHistory(serverSessionKey, '(println :srv2)');
    replHistory.addToReplHistory(uiSessionKey, '(println :ui1)');

    const serverHistory = state.extensionContext.workspaceState.get<string[]>(
      historyKeyFor(serverSessionKey),
      []
    );
    const uiHistory = state.extensionContext.workspaceState.get<string[]>(
      historyKeyFor(uiSessionKey),
      []
    );

    assert.deepStrictEqual(serverHistory, ['(println :srv1)', '(println :srv2)']);
    assert.deepStrictEqual(uiHistory, ['(println :ui1)']);
  });

  test('navigates history per custom session key', async () => {
    replHistory.addToReplHistory(serverSessionKey, '(println :srv1)');
    replHistory.addToReplHistory(serverSessionKey, '(println :srv2)');
    replHistory.addToReplHistory(uiSessionKey, '(println :ui1)');

    const editor = await focusReplWindow();
    await appendPromptForSession(serverSessionKey, editor);
    replHistory.resetState();
    replHistory.showPreviousReplHistoryEntry();

    await testUtil.waitForCondition(() => documentEndsWith(editor, '(println :srv2)'));

    await appendPromptForSession(uiSessionKey, editor);
    replHistory.resetState();
    replHistory.showPreviousReplHistoryEntry();

    await testUtil.waitForCondition(() => documentEndsWith(editor, '(println :ui1)'));
  });

  test('navigates forward through history and restores prompt text', async () => {
    const promptText = '(+ 2 3)';
    replHistory.addToReplHistory(serverSessionKey, '(inc 0)');
    replHistory.addToReplHistory(serverSessionKey, '(dec 2)');

    const editor = await focusReplWindow();
    await appendPromptForSession(serverSessionKey, editor);
    await typeAtPrompt(editor, promptText);

    replHistory.resetState();
    replHistory.showPreviousReplHistoryEntry();
    await testUtil.waitForCondition(() => documentEndsWith(editor, '(dec 2)'));

    replHistory.showPreviousReplHistoryEntry();
    await testUtil.waitForCondition(() => documentEndsWith(editor, '(inc 0)'));

    replHistory.showNextReplHistoryEntry();
    await testUtil.waitForCondition(() => documentEndsWith(editor, '(dec 2)'));

    replHistory.showNextReplHistoryEntry();
    await testUtil.waitForCondition(() => documentEndsWith(editor, promptText));
  });

  test('clears history only for the active session', async () => {
    replHistory.addToReplHistory(serverSessionKey, '(println :srv1)');
    replHistory.addToReplHistory(uiSessionKey, '(println :ui1)');

    setSessionKey(serverSessionKey);
    assert.strictEqual(outputWindow.getSessionType(), serverSessionKey);
    replHistory.clearHistory();

    await testUtil.waitForCondition(() => {
      const serverHistory = state.extensionContext.workspaceState.get<string[]>(
        historyKeyFor(serverSessionKey)
      );
      return Array.isArray(serverHistory) && serverHistory.length === 0;
    });
    const uiHistory =
      state.extensionContext.workspaceState.get<string[]>(historyKeyFor(uiSessionKey)) ?? [];
    assert.deepStrictEqual(uiHistory, ['(println :ui1)']);
  });
});
