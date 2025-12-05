import * as assert from 'assert';
import { before, after, beforeEach, afterEach } from 'mocha';
import * as path from 'path';
import * as vscode from 'vscode';
import * as outputWindow from '../../../repl-window/repl-window-doc';
import * as clientRegistry from '../../../nrepl/client-registry';
import * as sessionRegistry from '../../../nrepl/session-registry';
import * as fruitSuffix from '../../../nrepl/fruit-suffix';
import connector from '../../../connector';
import * as testUtil from './util';

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
  const jackInHarness = new testUtil.JackInHarness(suiteName);
  const firstProjectFile = path.join(testUtil.testDataDir, 'test.clj');
  const secondProjectFile = path.join(
    testUtil.testDataDir,
    '..',
    'projects',
    'minimal-deps',
    'src',
    'minimal',
    'hello.clj'
  );

  let baseClientKey: string | undefined;
  let secondClientKey: string | undefined;

  before(async () => {
    testUtil.showMessage(suiteName, `suite starting!`);
    await vscode.workspace.fs.copy(settingsUri, settingsBackupUri, { overwrite: true });
    await testUtil.ensureOutputDir(testUtil.testDataDir);
    await jackInHarness.disconnectAllClients();
    fruitSuffix.resetPool();
  });

  after(async () => {
    testUtil.showMessage(suiteName, `suite done!`);
    await jackInHarness.disconnectAllClients();
    fruitSuffix.resetPool();
    await vscode.workspace.fs.delete(settingsBackupUri);
  });

  beforeEach(async () => {
    await vscode.workspace.fs.copy(settingsBackupUri, settingsUri, { overwrite: true });
    await outputWindow.clearReplWindowDoc();
    jackInHarness.reset();
    await ensureBaseConnection();
  });

  afterEach(async () => {
    // Keep base and second connections alive across tests
  });

  test('Second project with same session names gets fruit suffix', async function () {
    this.timeout(120_000);
    testUtil.log(suiteName, 'Testing: Second project gets fruit suffix');

    await writeSettings({});

    const firstClientKey = await ensureBaseConnection();
    const secondClientKey = await ensureSecondConnection();
    const firstSessions = sessionRegistry.listSessionsByClient(firstClientKey);
    const firstSessionKeys = firstSessions.map((s) => s.key);
    testUtil.log(suiteName, 'First project session keys:', firstSessionKeys);

    assert.ok(
      firstSessionKeys.includes('clj'),
      `First project should have 'clj' session, got: ${firstSessionKeys}`
    );

    const allClients = clientRegistry.listClients();
    assert.strictEqual(allClients.length, 2, 'Should have two clients after second jack-in');

    const secondSessions = sessionRegistry.listSessionsByClient(secondClientKey);
    const secondSessionKeys = secondSessions.map((s) => s.key);
    testUtil.log(suiteName, 'Second project session keys:', secondSessionKeys);

    const hasFruitSuffix = secondSessionKeys.some((key) => fruitSuffix.extractFruitSuffix(key));
    assert.ok(
      hasFruitSuffix,
      `Second project should have fruit-suffixed sessions, got: ${secondSessionKeys}`
    );

    const usedFruit = await getFruitSuffixForClient(secondClientKey);
    assert.ok(usedFruit, 'Second connection should have a fruit suffix');
    testUtil.log(suiteName, 'Second project fruit suffix:', usedFruit);
  });

  test('Disconnecting releases fruit suffix back to pool', async function () {
    this.timeout(120_000);
    testUtil.log(suiteName, 'Testing: Disconnect releases fruit suffix');

    await writeSettings({});
    await ensureBaseConnection();
    const secondClientKey = await ensureSecondConnection();

    const clientsBeforeDisconnect = clientRegistry.listClients();
    assert.strictEqual(
      clientsBeforeDisconnect.length,
      2,
      'Should have two clients before disconnect'
    );
    const usedFruit = await getFruitSuffixForClient(secondClientKey);

    testUtil.log(suiteName, 'Fruit used before disconnect:', usedFruit);
    assert.ok(usedFruit, 'Second connection should have a fruit suffix');

    const availableBefore = fruitSuffix.getAvailableFruits();
    assert.ok(
      !availableBefore.includes(usedFruit),
      `Fruit '${usedFruit}' should not be available while in use`
    );

    await connector.disconnect({ clientKey: secondClientKey });
    await testUtil.sleep(500);

    const availableAfter = fruitSuffix.getAvailableFruits();
    assert.ok(
      availableAfter.includes(usedFruit),
      `Fruit '${usedFruit}' should be available after disconnect`
    );

    testUtil.log(suiteName, 'Fruit released successfully:', usedFruit);
  });

  async function ensureBaseConnection(): Promise<string> {
    if (baseClientKey) {
      const existing = clientRegistry.getClient(baseClientKey);
      if (existing) {
        return baseClientKey;
      }
    }

    baseClientKey = await jackInHarness.jackInWithQuickPick(firstProjectFile, 'deps.edn');
    return baseClientKey;
  }

  async function ensureSecondConnection(): Promise<string> {
    if (secondClientKey) {
      const existing = clientRegistry.getClient(secondClientKey);
      if (existing) {
        return secondClientKey;
      }
    }

    secondClientKey = await jackInHarness.jackInWithQuickPick(secondProjectFile, 'deps.edn');
    return secondClientKey;
  }

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

  async function getFruitSuffixForClient(clientKey: string): Promise<string | undefined> {
    const state = clientRegistry.getConnectionState(clientKey);
    if (state?.fruitSuffix) {
      return state.fruitSuffix;
    }

    const sessions = sessionRegistry.listSessionsByClient(clientKey);
    const suffix = sessions.map((s) => fruitSuffix.extractFruitSuffix(s.key)).find(Boolean);
    return await Promise.resolve(suffix);
  }
});
