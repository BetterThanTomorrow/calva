import * as assert from 'assert';
import { before, after, beforeEach } from 'mocha';
import * as path from 'path';
import * as testUtil from './util';
import * as clientRegistry from '../../../nrepl/client-registry';
import * as sessionRegistry from '../../../nrepl/session-registry';
import * as replSession from '../../../nrepl/repl-session';
import * as vscode from 'vscode';
import { commands } from 'vscode';
import * as outputWindow from '../../../repl-window/repl-doc';
import { getDocument } from '../../../doc-mirror';
import connector from '../../../connector';

const suiteName = 'CLJC Routing';

const settingsUri: vscode.Uri = vscode.Uri.joinPath(
  vscode.workspace.workspaceFolders[0].uri,
  '.vscode',
  'settings.json'
);
const settingsBackupUri: vscode.Uri = vscode.Uri.joinPath(
  vscode.workspace.workspaceFolders[0].uri,
  '.vscode',
  'settings.json.bak'
);

// Project paths - computed once
const projectDir = path.join(testUtil.testDataDir, '..', 'projects', 'cljs-only');
const cljsFile = path.join(projectDir, 'src', 'hello_world', 'core.cljs');
const cljcFile = path.join(projectDir, 'src', 'hello_world', 'core.cljc');
const ednFile = path.join(projectDir, 'deps.edn');
const fiddleFile = path.join(projectDir, 'hello.fiddle');

// Files outside the connected project (in test-data/integration-test)
const outsideCljcFile = path.join(testUtil.testDataDir, 'test.cljc');
const outsideFiddleFile = path.join(testUtil.testDataDir, 'test.fiddle');

suite('CLJC Routing suite', function () {
  // Increase timeout for the entire suite since we jack-in once
  this.timeout(180_000);

  let clientKey: string;

  before(async () => {
    testUtil.showMessage(suiteName, `suite starting!`);
    await vscode.workspace.fs.copy(settingsUri, settingsBackupUri, { overwrite: true });
    await testUtil.ensureOutputDir(testUtil.testDataDir);

    // Clean up any stale clients
    const existingClients = clientRegistry.listClients();
    for (const client of existingClients) {
      try {
        await connector.disconnect({ clientKey: client.key });
      } catch {
        // Ignore errors during cleanup
      }
    }

    // Jack-in once for all tests
    await jackInToClojureScriptProject();

    // Verify we have both clj and cljs sessions
    const clients = clientRegistry.listClients();
    assert.strictEqual(clients.length, 1, 'Should have one client after jack-in');
    clientKey = clients[0].key;

    const sessions = sessionRegistry.listSessionsByClient(clientKey);
    const sessionKeys = sessions.map((s) => s.key);
    testUtil.log(suiteName, 'Session keys:', sessionKeys);

    assert.ok(sessionKeys.includes('clj'), 'Should have clj session');
    assert.ok(sessionKeys.includes('cljs'), 'Should have cljs session');
  });

  after(async () => {
    testUtil.showMessage(suiteName, `suite done!`);

    // Disconnect after all tests
    const clients = clientRegistry.listClients();
    for (const client of clients) {
      try {
        await connector.disconnect({ clientKey: client.key });
      } catch {
        // Ignore errors during cleanup
      }
    }

    await vscode.workspace.fs.delete(settingsBackupUri);
  });

  beforeEach(async () => {
    // Reset cljc target to primary before each test
    clientRegistry.setCljcTargetForConnection(clientKey, 'primary');
  });

  test('Routes .edn files to clj session via glob match', async function () {
    testUtil.log(suiteName, 'Testing: Routes .edn files to clj session');

    await testUtil.openFile(ednFile);

    const routingInfo = replSession.getRoutingInfo();
    testUtil.log(suiteName, 'Routing info for .edn file:', routingInfo);

    assert.strictEqual(routingInfo?.sessionKey, 'clj', '.edn file should route to clj session');
    assert.strictEqual(routingInfo?.reason.type, 'glob-match', '.edn should route via glob-match');
  });

  test('Routes .cljs files to cljs session via glob match', async function () {
    testUtil.log(suiteName, 'Testing: Routes .cljs files to cljs session');

    await testUtil.openFile(cljsFile);

    const routingInfo = replSession.getRoutingInfo();
    testUtil.log(suiteName, 'Routing info for .cljs file:', routingInfo);

    assert.strictEqual(routingInfo?.sessionKey, 'cljs', '.cljs file should route to cljs session');
    assert.strictEqual(routingInfo?.reason.type, 'glob-match', '.cljs should route via glob-match');
  });

  test('Routes .cljc files using cljc-within-connection routing', async function () {
    testUtil.log(suiteName, 'Testing: Routes .cljc files using cljc target preference');

    await testUtil.openFile(cljcFile);

    const routingInfo = replSession.getRoutingInfo();
    testUtil.log(suiteName, 'Routing for .cljc file:', routingInfo);

    assert.strictEqual(
      routingInfo?.reason.type,
      'cljc-within-connection',
      '.cljc file should use cljc-within-connection routing'
    );

    // Default cljc target is 'primary' which maps to clj
    const target = clientRegistry.getCljcTargetForConnection(clientKey);
    assert.strictEqual(target, 'primary', 'Default cljc target should be primary');
    assert.strictEqual(routingInfo?.sessionKey, 'clj', '.cljc should route to clj (primary)');
  });

  test('Toggle command switches cljc routing between clj and cljs', async function () {
    testUtil.log(suiteName, 'Testing: Toggle cljc target switches routing');

    await testUtil.openFile(cljcFile);

    // Initial routing should be to clj (primary)
    const initialRouting = replSession.getRoutingInfo();
    assert.strictEqual(initialRouting?.sessionKey, 'clj', 'Initial routing should be clj');

    // Toggle cljc target
    await commands.executeCommand('calva.toggleCLJCSession');
    await testUtil.sleep(50);

    // After toggle, should route to cljs (secondary)
    const afterToggleRouting = replSession.getRoutingInfo();
    testUtil.log(suiteName, 'After toggle routing:', afterToggleRouting);

    assert.strictEqual(
      afterToggleRouting?.sessionKey,
      'cljs',
      'After toggle, .cljc should route to cljs'
    );
    assert.strictEqual(
      clientRegistry.getCljcTargetForConnection(clientKey),
      'secondary',
      'After toggle, cljc target should be secondary'
    );

    // Toggle again - should go back to clj
    await commands.executeCommand('calva.toggleCLJCSession');
    await testUtil.sleep(50);

    const afterSecondToggleRouting = replSession.getRoutingInfo();
    assert.strictEqual(
      afterSecondToggleRouting?.sessionKey,
      'clj',
      'After second toggle, .cljc should route back to clj'
    );
  });

  test('Select command sets specific cljc target', async function () {
    testUtil.log(suiteName, 'Testing: Select cljc target command');

    await testUtil.openFile(cljcFile);

    // Select secondary target directly
    await commands.executeCommand('calva.selectCljcTarget', 'secondary');
    await testUtil.sleep(50);

    const afterSelectSecondary = replSession.getRoutingInfo();
    testUtil.log(suiteName, 'After select secondary:', afterSelectSecondary);

    assert.strictEqual(
      afterSelectSecondary?.sessionKey,
      'cljs',
      'After selecting secondary, .cljc should route to cljs'
    );
    assert.strictEqual(
      clientRegistry.getCljcTargetForConnection(clientKey),
      'secondary',
      'Target should be secondary'
    );

    // Select primary target directly
    await commands.executeCommand('calva.selectCljcTarget', 'primary');
    await testUtil.sleep(50);

    const afterSelectPrimary = replSession.getRoutingInfo();
    assert.strictEqual(
      afterSelectPrimary?.sessionKey,
      'clj',
      'After selecting primary, .cljc should route to clj'
    );
  });

  test('Fiddle files use cljc routing and respond to toggle', async function () {
    testUtil.log(suiteName, 'Testing: Fiddle files use cljc routing');

    await testUtil.openFile(fiddleFile);

    const initialRouting = replSession.getRoutingInfo();
    testUtil.log(suiteName, 'Routing for .fiddle file:', initialRouting);

    // Fiddle files land in project-fallback tier and should use cljc-within-connection routing
    assert.strictEqual(
      initialRouting?.reason.type,
      'cljc-within-connection',
      '.fiddle file should use cljc-within-connection routing'
    );
    assert.strictEqual(
      initialRouting?.sessionKey,
      'clj',
      '.fiddle file should route to clj (primary)'
    );

    // Toggle and verify it changes
    await commands.executeCommand('calva.toggleCLJCSession');
    await testUtil.sleep(50);

    const afterToggleRouting = replSession.getRoutingInfo();
    assert.strictEqual(
      afterToggleRouting?.sessionKey,
      'cljs',
      'After toggle, .fiddle should route to cljs'
    );
  });

  test('Cljc target changes do not affect .clj and .cljs routing', async function () {
    testUtil.log(suiteName, 'Testing: Cljc target does not affect .clj/.cljs files');

    // Set cljc target to secondary (cljs)
    clientRegistry.setCljcTargetForConnection(clientKey, 'secondary');

    // Open .cljs file - should still route via glob match
    await testUtil.openFile(cljsFile);

    const cljsRouting = replSession.getRoutingInfo();
    testUtil.log(suiteName, '.cljs routing with secondary cljc target:', cljsRouting);

    assert.strictEqual(cljsRouting?.sessionKey, 'cljs', '.cljs should route to cljs');
    assert.strictEqual(
      cljsRouting?.reason.type,
      'glob-match',
      '.cljs should route via glob-match, not cljc preference'
    );

    // Open .edn file - should still route via glob match
    await testUtil.openFile(ednFile);

    const ednRouting = replSession.getRoutingInfo();
    testUtil.log(suiteName, '.edn routing with secondary cljc target:', ednRouting);

    assert.strictEqual(ednRouting?.sessionKey, 'clj', '.edn should route to clj');
    assert.strictEqual(
      ednRouting?.reason.type,
      'glob-match',
      '.edn should route via glob-match, not cljc preference'
    );
  });

  test('Files outside project root still respect cljc target (.cljc)', async function () {
    testUtil.log(suiteName, 'Testing: .cljc file outside project respects cljc target');

    await testUtil.openFile(outsideCljcFile);

    const routingInfo = replSession.getRoutingInfo();
    testUtil.log(suiteName, 'Routing for outside .cljc file:', routingInfo);

    // Files outside the connected project don't match any globs,
    // but cljc target preference is still applied
    assert.strictEqual(
      routingInfo?.reason.type,
      'cljc-within-connection',
      '.cljc file outside project should use cljc-within-connection routing'
    );
    assert.strictEqual(
      routingInfo?.sessionKey,
      'clj',
      '.cljc file outside project should route to clj (primary)'
    );

    // Toggle and verify it changes
    await commands.executeCommand('calva.toggleCLJCSession');
    await testUtil.sleep(50);

    const afterToggleRouting = replSession.getRoutingInfo();
    assert.strictEqual(
      afterToggleRouting?.sessionKey,
      'cljs',
      'After toggle, outside .cljc should route to cljs'
    );
  });

  test('Files outside project root still respect cljc target (.fiddle)', async function () {
    testUtil.log(suiteName, 'Testing: .fiddle file outside project respects cljc target');

    await testUtil.openFile(outsideFiddleFile);

    const routingInfo = replSession.getRoutingInfo();
    testUtil.log(suiteName, 'Routing for outside .fiddle file:', routingInfo);

    // Files outside the connected project don't match any globs,
    // but cljc target preference is still applied
    assert.strictEqual(
      routingInfo?.reason.type,
      'cljc-within-connection',
      '.fiddle file outside project should use cljc-within-connection routing'
    );
    assert.strictEqual(
      routingInfo?.sessionKey,
      'clj',
      '.fiddle file outside project should route to clj (primary)'
    );

    // Toggle and verify it changes
    await commands.executeCommand('calva.toggleCLJCSession');
    await testUtil.sleep(50);

    const afterToggleRouting = replSession.getRoutingInfo();
    assert.strictEqual(
      afterToggleRouting?.sessionKey,
      'cljs',
      'After toggle, outside .fiddle should route to cljs'
    );
  });

  // Helper functions

  async function writeSettings(settings: Record<string, unknown>): Promise<void> {
    const settingsData = JSON.stringify(settings, null, 2);
    await vscode.workspace.fs.writeFile(settingsUri, new TextEncoder().encode(settingsData));

    const config = vscode.workspace.getConfiguration();
    const sections: Array<[string, unknown]> = Object.entries(settings);

    if (!('calva.replConnectSequences' in settings)) {
      sections.push(['calva.replConnectSequences', undefined]);
    }

    for (const [section, value] of sections) {
      await config.update(section, value, vscode.ConfigurationTarget.Workspace);
    }
  }

  let lastSeenClientConnectedAt = 0;
  let lastJackInDoneCount = 0;

  async function jackInToClojureScriptProject(): Promise<void> {
    // Use a custom connect sequence with autoSelectForJackIn and projectRootPath
    // to bypass all QuickPicks and speed up test execution
    const connectSequenceName = 'cljc-routing-test-cljs-node';
    const settings = {
      'calva.replConnectSequences': [
        {
          name: connectSequenceName,
          projectType: 'deps.edn',
          cljsType: 'ClojureScript built-in for node',
          autoSelectForJackIn: true,
          // Path relative to workspace folder (test-data)
          projectRootPath: ['projects', 'cljs-only'],
        },
      ],
    };
    await writeSettings(settings);

    // Open a file in the project so VS Code has context
    await testUtil.openFile(cljsFile);
    testUtil.log(suiteName, `Opened file for jack-in: ${cljsFile}`);

    // Pass the connect sequence name directly to bypass QuickPicks
    await commands.executeCommand('calva.jackIn', {
      connectSequence: connectSequenceName,
      disableAutoSelect: true,
    });

    await waitForNextClient();
    await waitForBothSessions();
    await testUtil.sleep(500);
    testUtil.log(suiteName, 'Jack-in complete');
  }

  async function waitForBothSessions(): Promise<void> {
    const timeoutMs = 90_000;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const clients = clientRegistry.listClients();
      if (clients.length > 0) {
        const sessions = sessionRegistry.listSessionsByClient(clients[0].key);
        const sessionKeys = sessions.map((s) => s.key);
        if (sessionKeys.includes('clj') && sessionKeys.includes('cljs')) {
          testUtil.log(suiteName, 'Both clj and cljs sessions detected');
          return;
        }
        testUtil.log(suiteName, `Waiting for both sessions, current: ${sessionKeys.join(', ')}`);
      } else {
        testUtil.log(suiteName, 'Waiting for client...');
      }
      await testUtil.sleep(500);
    }
    throw new Error('Timeout waiting for both clj and cljs sessions');
  }

  async function waitForNextClient(): Promise<void> {
    const timeoutMs = 60_000;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const clients = clientRegistry.listClients();
      const newest = clients[clients.length - 1];
      if (newest && newest.connectedAt > lastSeenClientConnectedAt) {
        lastSeenClientConnectedAt = newest.connectedAt;
        testUtil.log(
          suiteName,
          `Detected new client ${newest.connectSequenceName ?? newest.key} (${
            newest.projectRoot ?? 'no-root'
          })`
        );
        return;
      }
      testUtil.log(suiteName, 'Waiting for new jack-in client...');
      await testUtil.sleep(500);
    }
    throw new Error('Timeout waiting for jack-in client');
  }

  async function waitForJackInCompletion(): Promise<void> {
    const timeoutMs = 90_000;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const resultsEditor = await outputWindow.openResultsDoc();
      const text = getDocument(resultsEditor).document.getText();

      const jackInDoneMatches = text.match(/Jack-in done\./g);
      const jackInDoneCount = jackInDoneMatches?.length ?? 0;

      if (jackInDoneCount > lastJackInDoneCount) {
        lastJackInDoneCount = jackInDoneCount;
        testUtil.log(suiteName, 'Jack-in completed (detected "Jack-in done.")');
        return;
      }

      testUtil.log(suiteName, 'Waiting for jack-in completion...');
      await testUtil.sleep(1000);
    }
    throw new Error('Timeout waiting for jack-in completion');
  }
});
