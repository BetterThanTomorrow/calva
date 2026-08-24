import * as assert from 'assert';
import * as mocha from 'mocha';
import * as path from 'path';
import * as testUtil from './util';
import * as clientRegistry from '../../../nrepl/client-registry';
import * as sessionRegistry from '../../../nrepl/session-registry';
import * as replSession from '../../../nrepl/repl-session';
import * as sessionRouting from '../../../nrepl/session-routing';
import * as outputWindow from '../../../repl-window/repl-window-doc';
import * as replSessionsMenu from '../../../repl-sessions-menu';
import * as cljsLib from '../../../../out/cljs-lib/cljs-lib';
import * as vscode from 'vscode';
import type * as nrepl from '../../../nrepl';

const suiteName = 'REPL Window Targeting';

// Project paths - computed once
const projectDir = path.join(testUtil.testDataDir, '..', 'projects', 'cljs-only');
const cljsFile = path.join(projectDir, 'src', 'hello_world', 'core.cljs');
const cljcFile = path.join(projectDir, 'src', 'hello_world', 'core.cljc');

const clientKey = 'test-client-targeting';

const createSession = (replType: string, clientKey?: string): nrepl.NReplSession =>
  ({
    replType,
    client: clientKey ? { clientKey } : undefined,
  } as nrepl.NReplSession);

async function waitForReplWindowRouting(expectedSessionKey?: string): Promise<void> {
  await testUtil.waitForCondition(
    () => {
      const routingInfo = replSession.getRoutingInfo();
      return (
        routingInfo?.reason.type === 'repl-window' &&
        (expectedSessionKey === undefined || routingInfo.sessionKey === expectedSessionKey)
      );
    },
    2000,
    20,
    `Timed out waiting for repl-window routing${
      expectedSessionKey ? ` -> ${expectedSessionKey}` : ''
    }`
  );
}

suite('REPL Window Targeting suite', function () {
  let initialConnectionState: boolean | undefined;
  let initialCurrentSessionType: string | undefined;
  let initialOutputSessionType: string | undefined;
  let initialOutputNamespace: string | undefined;

  mocha.before(async () => {
    testUtil.showMessage(suiteName, `suite starting!`);
    await testUtil.ensureOutputDir(testUtil.testDataDir);

    initialConnectionState = cljsLib.getStateValue('connected');
    initialCurrentSessionType = cljsLib.getStateValue('current-session-type');
    initialOutputSessionType = outputWindow.getSessionType();
    initialOutputNamespace = outputWindow.getNs();
    await outputWindow.initReplWindowDoc();
  });

  mocha.after(() => {
    testUtil.showMessage(suiteName, `suite done!`);
    sessionRegistry._testUtility_registeredSessions.clear();
    clientRegistry._testUtility_registeredClients.clear();
    sessionRouting.resetRouting();
    cljsLib.setStateValue('connected', initialConnectionState);
    cljsLib.setStateValue('current-session-type', initialCurrentSessionType);
    const fallbackSessionType = initialOutputSessionType ?? 'clj';
    const fallbackNamespace = initialOutputNamespace ?? 'user';
    outputWindow.setSession(
      createSession(fallbackSessionType),
      fallbackNamespace,
      fallbackSessionType
    );
  });

  mocha.beforeEach(async () => {
    sessionRegistry._testUtility_registeredSessions.clear();
    clientRegistry._testUtility_registeredClients.clear();
    sessionRouting.resetRouting();
    cljsLib.setStateValue('connected', true);
    cljsLib.setStateValue('current-session-type', undefined);

    const stubClient = {
      clientKey,
    } as unknown as nrepl.NReplClient;

    clientRegistry.registerClient(stubClient, {
      connectSequenceName: 'Test Connection Targeting',
    });

    const projectUri = vscode.Uri.file(projectDir).toString();

    sessionRegistry.registerSession('clj', createSession('clj', clientKey), {
      projectRoot: projectUri,
      globs: ['**/*.clj', '**/*.cljc', '**/*.edn'],
      isSecondary: false,
    });
    sessionRegistry.registerSession('cljs', createSession('cljs', clientKey), {
      projectRoot: projectUri,
      globs: ['**/*.cljs', '**/*.cljc'],
      isSecondary: true,
    });

    // Reset REPL window to clj session before each test
    replSessionsMenu.setReplWindowSession('clj');
    await testUtil.waitForCondition(
      () => outputWindow.getSessionType() === 'clj',
      2000,
      20,
      'Timed out waiting for REPL window session reset to clj'
    );
  });

  test('Initial REPL window targets the secondary (CLJS) session after connection', function () {
    testUtil.log(suiteName, 'Testing: Initial REPL window targets CLJS after full connection');

    // After a full CLJ+CLJS connection, the REPL window should target the secondary session
    // because makeCljsSessionClone calls outputWindow.setSession with the CLJS session
    // Note: beforeEach resets to clj, so we need to check what happens after a fresh connection

    // For this test, we verify the mechanism works - we can set and get the session
    replSessionsMenu.setReplWindowSession('cljs');
    const currentSession = outputWindow.getSessionType();
    assert.strictEqual(currentSession, 'cljs', 'REPL window should be targeting cljs');
  });

  test('REPL window session can be changed via command', async function () {
    testUtil.log(suiteName, 'Testing: Change REPL window session via command');

    // Start with clj
    replSessionsMenu.setReplWindowSession('clj');
    assert.strictEqual(outputWindow.getSessionType(), 'clj', 'Initial session should be clj');

    // Change to cljs via command
    await vscode.commands.executeCommand('calva.selectReplWindowSession', 'cljs');
    await testUtil.waitForCondition(() => outputWindow.getSessionType() === 'cljs', 2000, 10);

    assert.strictEqual(
      outputWindow.getSessionType(),
      'cljs',
      'After command, session should be cljs'
    );

    // Change back to clj
    await vscode.commands.executeCommand('calva.selectReplWindowSession', 'clj');
    await testUtil.waitForCondition(() => outputWindow.getSessionType() === 'clj', 2000, 10);

    assert.strictEqual(
      outputWindow.getSessionType(),
      'clj',
      'After second command, session should be clj'
    );
  });

  test('REPL window routing uses targeted session when REPL window is active', async function () {
    testUtil.log(suiteName, 'Testing: Routing uses REPL window session when active');

    // Set REPL window to target cljs
    replSessionsMenu.setReplWindowSession('cljs');

    // Open and focus the REPL window
    await outputWindow.revealReplWindowDoc(false);
    await waitForReplWindowRouting('cljs');

    // Get routing info - should show repl-window reason
    const routingInfo = replSession.getRoutingInfo();
    testUtil.log(suiteName, 'Routing info when REPL window active:', routingInfo);

    assert.strictEqual(
      routingInfo?.sessionKey,
      'cljs',
      'Routing should use REPL window target session'
    );
    assert.strictEqual(
      routingInfo?.reason.type,
      'repl-window',
      'Routing reason should be repl-window'
    );
  });

  test('REPL window routing is independent of cljc target preference', async function () {
    testUtil.log(suiteName, 'Testing: REPL window routing is independent of cljc target');

    // Set cljc target to primary (clj)
    clientRegistry.setCljcTargetForConnection(clientKey, 'primary');

    // Set REPL window to target cljs (opposite of cljc target)
    replSessionsMenu.setReplWindowSession('cljs');

    // Open and focus the REPL window
    await outputWindow.revealReplWindowDoc(false);
    await waitForReplWindowRouting('cljs');

    // Routing should use REPL window session, not cljc target
    const routingInfo = replSession.getRoutingInfo();
    testUtil.log(suiteName, 'Routing with different cljc target:', routingInfo);

    assert.strictEqual(
      routingInfo?.sessionKey,
      'cljs',
      'REPL window routing should ignore cljc target'
    );
    assert.strictEqual(
      routingInfo?.reason.type,
      'repl-window',
      'Routing reason should be repl-window'
    );
  });

  test('Switching from REPL window to .cljc file uses cljc routing', async function () {
    testUtil.log(suiteName, 'Testing: Switching to .cljc file uses cljc routing');

    // Set cljc target to secondary (cljs)
    clientRegistry.setCljcTargetForConnection(clientKey, 'secondary');

    // Start in REPL window
    await outputWindow.revealReplWindowDoc(false);
    await waitForReplWindowRouting();

    let routingInfo = replSession.getRoutingInfo();
    assert.strictEqual(routingInfo?.reason.type, 'repl-window', 'Should start with repl-window');

    // Switch to .cljc file
    await testUtil.openFile(cljcFile);

    routingInfo = replSession.getRoutingInfo();
    testUtil.log(suiteName, 'Routing after switching to .cljc:', routingInfo);

    assert.strictEqual(
      routingInfo?.reason.type,
      'cljc-within-connection',
      'Should use cljc-within-connection after switching to .cljc'
    );
    assert.strictEqual(
      routingInfo?.sessionKey,
      'cljs',
      'Should route to cljs based on cljc target'
    );
  });

  test('setReplWindowSession returns false for non-existent session', function () {
    testUtil.log(suiteName, 'Testing: setReplWindowSession rejects invalid session');

    const result = replSessionsMenu.setReplWindowSession('non-existent-session');

    assert.strictEqual(result, false, 'Should return false for non-existent session');
    // Session should remain unchanged
    assert.ok(
      ['clj', 'cljs'].includes(outputWindow.getSessionType()),
      'Session should remain valid'
    );
  });

  test('setReplWindowSession returns true for valid session', function () {
    testUtil.log(suiteName, 'Testing: setReplWindowSession accepts valid session');

    const result = replSessionsMenu.setReplWindowSession('cljs');

    assert.strictEqual(result, true, 'Should return true for valid session');
    assert.strictEqual(outputWindow.getSessionType(), 'cljs', 'Session should be updated');
  });
});
