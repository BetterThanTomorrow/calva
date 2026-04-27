import * as assert from 'assert';
import * as Mocha from 'mocha';
import * as path from 'path';
import * as sessionRegistry from '../../../nrepl/session-registry';
import * as clientRegistry from '../../../nrepl/client-registry';
import * as outputWindow from '../../../repl-window/repl-window-doc';
import connector from '../../../connector';
import * as cljsLib from '../../../../out/cljs-lib/cljs-lib';
import type * as nrepl from '../../../nrepl';
import * as sessionRouting from '../../../nrepl/session-routing';
import * as sessionTeardown from '../../../nrepl/session-teardown';
import * as testUtil from './util';

const { describe, before, beforeEach, afterEach, it } = Mocha;

const suiteName = 'Connection isolation';

const createSession = (replType: string, clientKey?: string): nrepl.NReplSession =>
  ({
    replType,
    client: clientKey ? { clientKey } : undefined,
  } as nrepl.NReplSession);

const resetOutputWindowSession = (sessionType: string, ns: string): void => {
  outputWindow.setSession(createSession(sessionType), ns, sessionType);
};

describe(`${suiteName} suite`, () => {
  let initialConnectionState: boolean | undefined;
  let initialCurrentSessionType: string | undefined;
  let initialOutputSessionType: string | undefined;
  let initialOutputNamespace: string | undefined;

  before(async () => {
    initialConnectionState = cljsLib.getStateValue('connected');
    initialCurrentSessionType = cljsLib.getStateValue('current-session-type');
    initialOutputSessionType = outputWindow.getSessionType();
    initialOutputNamespace = outputWindow.getNs();
    await outputWindow.initReplWindowDoc();
  });

  beforeEach(async () => {
    sessionRegistry._testUtility_registeredSessions.clear();
    sessionRegistry.setClojureDocsSessionKey(null);
    cljsLib.setStateValue('connected', true);
    cljsLib.setStateValue('current-session-type', undefined);
    sessionRouting.resetRouting();
    clientRegistry._testUtility_registeredClients.clear();
    resetOutputWindowSession('clj', 'user');
    // Open a test file to ensure there's an active editor (required by UI code paths)
    const testFilePath = path.join(testUtil.testDataDir, 'test.clj');
    await testUtil.openFile(testFilePath);
  });

  afterEach(() => {
    sessionRegistry._testUtility_registeredSessions.clear();
    sessionRegistry.setClojureDocsSessionKey(null);
    cljsLib.setStateValue('connected', initialConnectionState);
    cljsLib.setStateValue('current-session-type', initialCurrentSessionType);
    sessionRouting.resetRouting();
    clientRegistry._testUtility_registeredClients.clear();
    const fallbackSessionType = initialOutputSessionType ?? 'clj';
    const fallbackNamespace = initialOutputNamespace ?? 'user';
    resetOutputWindowSession(fallbackSessionType, fallbackNamespace);
  });

  it('session teardown by client key only affects that client sessions', () => {
    // Setup: Register two clients with sessions (simulating two active connections)
    const clientA = {
      clientKey: 'client-a',
      close: () => Promise.resolve(undefined),
      disconnect: () => undefined,
      addOnCloseHandler: () => undefined,
      removeOnCloseHandler: () => undefined,
    } as unknown as nrepl.NReplClient;

    const clientB = {
      clientKey: 'client-b',
      close: () => Promise.resolve(undefined),
      disconnect: () => undefined,
      addOnCloseHandler: () => undefined,
      removeOnCloseHandler: () => undefined,
    } as unknown as nrepl.NReplClient;

    clientRegistry.registerClient(clientA, {
      connectSequenceName: 'Connection A',
      projectRoot: 'file:///project-a',
    });

    clientRegistry.registerClient(clientB, {
      connectSequenceName: 'Connection B',
      projectRoot: 'file:///project-b',
    });

    sessionRegistry.registerSession('session-a', createSession('clj', 'client-a'), {
      projectRoot: 'file:///project-a',
      globs: ['**/*.clj'],
      connectionOwnerId: 'client-a',
      isSecondary: false,
    });

    sessionRegistry.registerSession('session-b', createSession('bb', 'client-b'), {
      projectRoot: 'file:///project-b',
      globs: ['**/*.bb'],
      connectionOwnerId: 'client-b',
      isSecondary: false,
    });

    // Verify initial state
    assert.strictEqual(sessionRegistry.listSessions().length, 2);
    assert.strictEqual(clientRegistry.listClients().length, 2);

    // Simulate cleanup for client-a only (as would happen during failed connection cleanup)
    sessionTeardown.teardownSessionsForClient('client-a');

    // Client B's session should remain intact
    const sessionsAfter = sessionRegistry.listSessions();

    assert.strictEqual(
      sessionsAfter.length,
      1,
      `Expected 1 session to remain, but found ${sessionsAfter.length}: ${sessionsAfter
        .map((s) => s.key)
        .join(', ')}`
    );
    assert.ok(sessionRegistry.getSession('session-b'), 'Session B should still exist');
    assert.ok(!sessionRegistry.getSession('session-a'), 'Session A should be removed');
  });

  it('teardown with undefined client key does not affect any sessions', () => {
    // This tests the fix: when a connection fails before creating a client,
    // cleanUpAfterError is called with undefined clientKey
    const clientA = {
      clientKey: 'client-a',
      close: () => Promise.resolve(undefined),
      disconnect: () => undefined,
      addOnCloseHandler: () => undefined,
      removeOnCloseHandler: () => undefined,
    } as unknown as nrepl.NReplClient;

    clientRegistry.registerClient(clientA, {
      connectSequenceName: 'Connection A',
      projectRoot: 'file:///project-a',
    });

    sessionRegistry.registerSession('session-a', createSession('clj', 'client-a'), {
      projectRoot: 'file:///project-a',
      globs: ['**/*.clj'],
      connectionOwnerId: 'client-a',
      isSecondary: false,
    });

    // Verify initial state
    assert.strictEqual(sessionRegistry.listSessions().length, 1);
    assert.strictEqual(clientRegistry.listClients().length, 1);

    // Simulate cleanup with undefined client key (as happens when connection fails early)
    // This should NOT affect any existing sessions
    sessionTeardown.teardownSessionsForClient(undefined as unknown as string);

    // All sessions should remain intact
    const sessionsAfter = sessionRegistry.listSessions();
    const clientsAfter = clientRegistry.listClients();

    assert.strictEqual(
      sessionsAfter.length,
      1,
      'Session should remain when clientKey is undefined'
    );
    assert.strictEqual(clientsAfter.length, 1, 'Client should remain when clientKey is undefined');
    assert.ok(sessionRegistry.getSession('session-a'), 'Session A should still exist');
  });

  it('multiple connections remain isolated during teardown operations', () => {
    // Setup: Register three clients with sessions
    const clients = ['client-a', 'client-b', 'client-c'].map((key) => ({
      clientKey: key,
      close: () => Promise.resolve(undefined),
      disconnect: () => undefined,
      addOnCloseHandler: () => undefined,
      removeOnCloseHandler: () => undefined,
    })) as unknown as nrepl.NReplClient[];

    clients.forEach((client, i) => {
      clientRegistry.registerClient(client, {
        connectSequenceName: `Connection ${String.fromCharCode(65 + i)}`,
        projectRoot: `file:///project-${String.fromCharCode(97 + i)}`,
      });

      sessionRegistry.registerSession(
        `session-${String.fromCharCode(97 + i)}`,
        createSession('clj', client.clientKey),
        {
          projectRoot: `file:///project-${String.fromCharCode(97 + i)}`,
          globs: [`**/project-${String.fromCharCode(97 + i)}/**/*.clj`],
          connectionOwnerId: client.clientKey,
          isSecondary: false,
        }
      );
    });

    // Verify initial state
    assert.strictEqual(sessionRegistry.listSessions().length, 3);
    assert.strictEqual(clientRegistry.listClients().length, 3);

    // Teardown client-b only
    clientRegistry.unregisterClient('client-b');
    sessionTeardown.teardownSessionsForClient('client-b');

    // Clients A and C should remain
    const sessionsAfter = sessionRegistry.listSessions();
    const clientsAfter = clientRegistry.listClients();

    assert.strictEqual(sessionsAfter.length, 2, 'Two sessions should remain');
    assert.strictEqual(clientsAfter.length, 2, 'Two clients should remain');
    assert.ok(sessionRegistry.getSession('session-a'), 'Session A should still exist');
    assert.ok(!sessionRegistry.getSession('session-b'), 'Session B should be removed');
    assert.ok(sessionRegistry.getSession('session-c'), 'Session C should still exist');
  });

  it('disconnect only removes the targeted client and its sessions', async () => {
    // Setup: Register two clients with sessions
    const clientA = {
      clientKey: 'client-a',
      close: () => Promise.resolve(undefined),
      disconnect: () => undefined,
      addOnCloseHandler: () => undefined,
      removeOnCloseHandler: () => undefined,
    } as unknown as nrepl.NReplClient;

    const clientB = {
      clientKey: 'client-b',
      close: () => Promise.resolve(undefined),
      disconnect: () => undefined,
      addOnCloseHandler: () => undefined,
      removeOnCloseHandler: () => undefined,
    } as unknown as nrepl.NReplClient;

    clientRegistry.registerClient(clientA, {
      connectSequenceName: 'Connection A',
      projectRoot: 'file:///project-a',
    });

    clientRegistry.registerClient(clientB, {
      connectSequenceName: 'Connection B',
      projectRoot: 'file:///project-b',
    });

    sessionRegistry.registerSession('session-a', createSession('clj', 'client-a'), {
      projectRoot: 'file:///project-a',
      globs: ['**/project-a/**/*.clj'],
      connectionOwnerId: 'client-a',
      isSecondary: false,
    });

    sessionRegistry.registerSession('session-b', createSession('bb', 'client-b'), {
      projectRoot: 'file:///project-b',
      globs: ['**/project-b/**/*.clj'],
      connectionOwnerId: 'client-b',
      isSecondary: false,
    });

    // Verify initial state
    assert.strictEqual(sessionRegistry.listSessions().length, 2);
    assert.strictEqual(clientRegistry.listClients().length, 2);

    // Disconnect client A
    await connector.disconnect({ clientKey: 'client-a' });

    // Client B and its session should remain
    const sessionsAfter = sessionRegistry.listSessions();
    const clientsAfter = clientRegistry.listClients();

    assert.strictEqual(sessionsAfter.length, 1, 'Only session-b should remain');
    assert.strictEqual(clientsAfter.length, 1, 'Only client-b should remain');
    assert.ok(sessionRegistry.getSession('session-b'), 'Session B should still exist');
    assert.strictEqual(clientsAfter[0].key, 'client-b', 'Client B should still be registered');
    assert.ok(!sessionRegistry.getSession('session-a'), 'Session A should be removed');
  });
});
