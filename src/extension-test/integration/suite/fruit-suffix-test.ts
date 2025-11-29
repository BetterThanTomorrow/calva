import * as assert from 'assert';
import { before, after, beforeEach, afterEach } from 'mocha';
import * as path from 'path';
import * as testUtil from './util';
import * as state from '../../../state';
import * as clientRegistry from '../../../nrepl/client-registry';
import * as sessionRegistry from '../../../nrepl/session-registry';
import * as fruitSuffix from '../../../nrepl/fruit-suffix';
import * as vscode from 'vscode';
import { commands } from 'vscode';
import * as outputWindow from '../../../repl-window/repl-doc';
import { getDocument } from '../../../doc-mirror';
import * as projectRoot from '../../../project-root';
import connector from '../../../connector';

const suiteName = 'Fruit Suffix';

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

suite('Fruit Suffix suite', () => {
  let lastSeenClientConnectedAt = 0;
  let lastJackInDoneCount = 0;

  before(async () => {
    testUtil.showMessage(suiteName, `suite starting!`);
    await vscode.workspace.fs.copy(settingsUri, settingsBackupUri, { overwrite: true });
    await testUtil.ensureOutputDir(testUtil.testDataDir);
  });

  after(async () => {
    testUtil.showMessage(suiteName, `suite done!`);
    await vscode.workspace.fs.delete(settingsBackupUri);
  });

  beforeEach(async () => {
    await vscode.workspace.fs.copy(settingsBackupUri, settingsUri, { overwrite: true });
    await outputWindow.clearResultsDoc();
    lastJackInDoneCount = 0;
    lastSeenClientConnectedAt = 0;
    fruitSuffix.resetPool();
  });

  afterEach(async () => {
    const clients = clientRegistry.listClients();
    for (const client of clients) {
      try {
        await connector.disconnect({ clientKey: client.key });
      } catch {
        // Ignore errors during cleanup
      }
    }
    fruitSuffix.resetPool();
  });

  test('Second project with same session names gets fruit suffix', async function () {
    this.timeout(120_000);
    testUtil.log(suiteName, 'Testing: Second project gets fruit suffix');

    const settings = {};
    await writeSettings(settings);

    // Jack into first project (integration-test folder)
    const firstFilePath = path.join(testUtil.testDataDir, 'test.clj');
    await jackInToProject(firstFilePath, 'deps.edn');

    // Verify first project has base session name 'clj'
    const firstClients = clientRegistry.listClients();
    assert.strictEqual(firstClients.length, 1, 'Should have one client after first jack-in');

    const firstClientKey = firstClients[0].key;
    const firstSessions = sessionRegistry.listSessionsByClient(firstClientKey);
    const firstSessionKeys = firstSessions.map((s) => s.key);
    testUtil.log(suiteName, 'First project session keys:', firstSessionKeys);

    assert.ok(
      firstSessionKeys.includes('clj'),
      `First project should have 'clj' session, got: ${firstSessionKeys}`
    );

    // Jack into second project (minimal-deps)
    const secondFilePath = path.join(
      testUtil.testDataDir,
      '..',
      'projects',
      'minimal-deps',
      'src',
      'minimal',
      'hello.clj'
    );
    await jackInToProject(secondFilePath, 'deps.edn');

    const allClients = clientRegistry.listClients();
    assert.strictEqual(allClients.length, 2, 'Should have two clients after second jack-in');

    const secondClientKey = allClients.find((c) => c.key !== firstClientKey)?.key;
    assert.ok(secondClientKey, 'Should find second client');

    const secondSessions = sessionRegistry.listSessionsByClient(secondClientKey);
    const secondSessionKeys = secondSessions.map((s) => s.key);
    testUtil.log(suiteName, 'Second project session keys:', secondSessionKeys);

    // Second project should have a fruit-suffixed session name
    const hasFruitSuffix = secondSessionKeys.some((key) => fruitSuffix.extractFruitSuffix(key));
    assert.ok(
      hasFruitSuffix,
      `Second project should have fruit-suffixed sessions, got: ${secondSessionKeys}`
    );

    // Verify the fruit suffix is recorded in connection state
    const secondConnectionState = clientRegistry.getConnectionState(secondClientKey);
    assert.ok(
      secondConnectionState?.fruitSuffix,
      'Second connection should have fruitSuffix in state'
    );
    testUtil.log(suiteName, 'Second project fruit suffix:', secondConnectionState.fruitSuffix);
  });

  test('Disconnecting releases fruit suffix back to pool', async function () {
    this.timeout(120_000);
    testUtil.log(suiteName, 'Testing: Disconnect releases fruit suffix');

    const settings = {};
    await writeSettings(settings);

    // Jack into first project
    const firstFilePath = path.join(testUtil.testDataDir, 'test.clj');
    await jackInToProject(firstFilePath, 'deps.edn');

    // Jack into second project (will get fruit suffix)
    const secondFilePath = path.join(
      testUtil.testDataDir,
      '..',
      'projects',
      'minimal-deps',
      'src',
      'minimal',
      'hello.clj'
    );
    await jackInToProject(secondFilePath, 'deps.edn');

    const clientsBeforeDisconnect = clientRegistry.listClients();
    const secondClientKey = clientsBeforeDisconnect[1].key;
    const connectionState = clientRegistry.getConnectionState(secondClientKey);
    const usedFruit = connectionState?.fruitSuffix;

    testUtil.log(suiteName, 'Fruit used before disconnect:', usedFruit);
    assert.ok(usedFruit, 'Second connection should have a fruit suffix');

    // Check fruit is in use
    const availableBefore = fruitSuffix.getAvailableFruits();
    assert.ok(
      !availableBefore.includes(usedFruit),
      `Fruit '${usedFruit}' should not be available while in use`
    );

    // Disconnect the second client
    await connector.disconnect({ clientKey: secondClientKey });
    await testUtil.sleep(500);

    // Check fruit is released
    const availableAfter = fruitSuffix.getAvailableFruits();
    assert.ok(
      availableAfter.includes(usedFruit),
      `Fruit '${usedFruit}' should be available after disconnect`
    );

    testUtil.log(suiteName, 'Fruit released successfully:', usedFruit);
  });

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

  async function jackInToProject(testFilePath: string, projectType: string): Promise<void> {
    await testUtil.openFile(testFilePath);
    testUtil.log(suiteName, `Opened file for jack-in: ${testFilePath}`);

    const projectRootUri = projectRoot.findClosestParent(
      vscode.window.activeTextEditor?.document.uri,
      await projectRoot.findProjectRoots()
    );
    testUtil.log(suiteName, `Project root: ${projectRootUri?.toString()}`);

    // Pre-select project type
    const saveAs = `qps-${projectRootUri.toString()}/jack-in-type`;
    await state.extensionContext.workspaceState.update(saveAs, { label: projectType });

    let resolved = false;
    void commands.executeCommand('calva.jackIn').then(() => {
      resolved = true;
    });

    while (!resolved) {
      await commands.executeCommand('workbench.action.acceptSelectedQuickOpenItem');
      await testUtil.sleep(100);
    }

    await waitForNextClient();
    await waitForJackInCompletion();
    await testUtil.sleep(500);
    testUtil.log(suiteName, 'Jack-in complete');
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
      await testUtil.sleep(250);
    }
    throw new Error('Timed out waiting for new jack-in client');
  }

  async function waitForJackInCompletion(): Promise<void> {
    const timeoutMs = 60_000;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const resultsEditor = await outputWindow.openResultsDoc();
      const text = getDocument(resultsEditor).document.getText();
      const currentCount = (text.match(/Jack-in done\./g) || []).length;
      if (currentCount > lastJackInDoneCount) {
        lastJackInDoneCount = currentCount;
        testUtil.log(suiteName, 'Jack-in completion detected');
        return;
      }
      testUtil.log(suiteName, 'Waiting for jack-in completion output...');
      await testUtil.sleep(250);
    }
    throw new Error('Timed out waiting for jack-in completion output');
  }
});
