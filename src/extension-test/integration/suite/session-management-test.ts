import * as assert from 'assert';
import { before, beforeEach, afterEach, describe, it } from 'mocha';
import * as path from 'path';
import * as vscode from 'vscode';
import * as sessionRegistry from '../../../nrepl/session-registry';
import * as outputWindow from '../../../repl-window/repl-doc';
import connector from '../../../connector';
import * as replApi from '../../../api/repl-v1';
import * as replSession from '../../../nrepl/repl-session';
import { getStateValue, setStateValue } from '../../../../out/cljs-lib/cljs-lib';
import type { NReplSession } from '../../../nrepl';
import * as testUtil from './util';

const suiteName = 'Session management';
const serverSessionKey = 'session-management/server';
const uiSessionKey = 'session-management/ui';

const createSession = (replType: string): NReplSession =>
  ({
    replType,
  } as NReplSession);

const resetOutputWindowSession = (sessionType: string, ns: string): void => {
  outputWindow.setSession(createSession(sessionType), ns, sessionType);
};

describe(`${suiteName} suite`, () => {
  let initialConnectionState: boolean | undefined;
  let initialCurrentSessionType: string | undefined;
  let initialOutputSessionType: string | undefined;
  let initialOutputNamespace: string | undefined;

  before(async () => {
    initialConnectionState = getStateValue('connected');
    initialCurrentSessionType = getStateValue('current-session-type');
    initialOutputSessionType = outputWindow.getSessionType();
    initialOutputNamespace = outputWindow.getNs();
    await outputWindow.initResultsDoc();
  });

  beforeEach(() => {
    sessionRegistry.clearAllSessions();
    setStateValue('connected', true);
    setStateValue('current-session-type', undefined);
    resetOutputWindowSession('clj', 'user');
  });

  afterEach(() => {
    sessionRegistry.clearAllSessions();
    setStateValue('connected', initialConnectionState);
    setStateValue('current-session-type', initialCurrentSessionType);
    const fallbackSessionType = initialOutputSessionType ?? 'clj';
    const fallbackNamespace = initialOutputNamespace ?? 'user';
    resetOutputWindowSession(fallbackSessionType, fallbackNamespace);
  });

  it('exposes registered sessions through the public API', () => {
    sessionRegistry.registerSession(serverSessionKey, createSession('clj'), {
      name: 'Server',
      projectRoot: 'file:///server',
      globs: ['apps/server/**'],
    });
    sessionRegistry.registerSession(uiSessionKey, createSession('cljs'), {
      name: 'UI',
      projectRoot: 'file:///ui',
      globs: ['apps/ui/**'],
    });

    const sessions = replApi.listSessions();
    assert.strictEqual(sessions.length, 2);
    const keys = sessions.map((s) => s.key).sort();
    assert.deepStrictEqual(keys, [serverSessionKey, uiSessionKey]);
    const serverMeta = sessions.find((s) => s.key === serverSessionKey);
    assert.strictEqual(serverMeta.name, 'Server');
    assert.deepStrictEqual(serverMeta.globs, ['apps/server/**']);
  });

  it('toggle command cycles through registered session keys', async () => {
    const serverSession = createSession('clj');
    const uiSession = createSession('cljs');
    sessionRegistry.registerSession(serverSessionKey, serverSession, {
      name: 'Server',
      globs: ['**/*.clj'],
    });
    sessionRegistry.registerSession(uiSessionKey, uiSession, {
      name: 'UI',
      globs: ['**/*.cljs'],
    });

    const replEditor = await outputWindow.revealResultsDoc(false);
    outputWindow.setSession(serverSession, 'user', serverSessionKey);
    setStateValue('current-session-type', serverSessionKey);

    connector.toggleCLJCSession();

    assert.strictEqual(getStateValue('current-session-type'), uiSessionKey);
    assert.strictEqual(outputWindow.getSessionType(), uiSessionKey);

    connector.toggleCLJCSession();

    assert.strictEqual(getStateValue('current-session-type'), serverSessionKey);
    assert.strictEqual(outputWindow.getSessionType(), serverSessionKey);

    if (vscode.window.activeTextEditor?.document === replEditor.document) {
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    }
  });

  it('honors session glob mappings when resolving active files', async () => {
    const cljSession = createSession('clj');
    const cljsSession = createSession('cljs');
    sessionRegistry.registerSession(serverSessionKey, cljSession, {
      name: 'Server',
      globs: ['**/*.clj'],
    });
    sessionRegistry.registerSession(uiSessionKey, cljsSession, {
      name: 'UI',
      globs: ['**/*.cljs'],
    });

    const testFilePath = path.join(testUtil.testDataDir, 'test.clj');
    await testUtil.openFile(testFilePath);

    const resolved = replSession.getSession();
    assert.strictEqual(resolved, cljSession);
  });
});
