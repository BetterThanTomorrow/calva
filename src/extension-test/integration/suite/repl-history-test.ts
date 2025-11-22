import * as assert from 'assert';
import { before, after, beforeEach } from 'mocha';
import * as vscode from 'vscode';
import * as testUtil from './util';
import * as state from '../../../state';
import * as outputWindow from '../../../repl-window/repl-doc';
import * as replHistory from '../../../repl-window/repl-history';
import type { NReplSession } from '../../../nrepl';

const suiteName = 'REPL history';
const serverSessionKey = 'app.server';
const uiSessionKey = 'app.ui';
const sessionKeys = [serverSessionKey, uiSessionKey];

async function waitForCondition(predicate: () => boolean, timeoutMs = 4000, intervalMs = 50) {
  const start = Date.now();
  while (true) {
    if (predicate()) {
      return;
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await testUtil.sleep(intervalMs);
  }
}

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
  const editor = await outputWindow.revealResultsDoc(false);
  await vscode.commands.executeCommand('cursorMove', { to: 'viewPortBottom' });
  return editor;
}

async function appendPromptForSession(sessionKey: string, editor: vscode.TextEditor) {
  setSessionKey(sessionKey);
  const beforeLength = editor.document.getText().length;
  outputWindow.appendPrompt();
  await waitForCondition(() => editor.document.getText().length > beforeLength);
}

suite(`${suiteName} suite`, () => {
  before(async () => {
    testUtil.showMessage(suiteName, 'suite starting!');
    await outputWindow.initResultsDoc();
  });

  after(async () => {
    testUtil.showMessage(suiteName, 'suite done!');
  });

  beforeEach(async () => {
    await clearHistoryForSessions();
    replHistory.resetState();
  });

  test('stores history per session key', async () => {
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

    await waitForCondition(() => editor.document.getText().trimEnd().endsWith('(println :srv2)'));

    await appendPromptForSession(uiSessionKey, editor);
    replHistory.resetState();
    replHistory.showPreviousReplHistoryEntry();

    await waitForCondition(() => editor.document.getText().trimEnd().endsWith('(println :ui1)'));
  });
});
