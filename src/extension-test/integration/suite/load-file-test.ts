import * as vscode from 'vscode';
import * as assert from 'assert';
import * as path from 'path';
import { before, after, beforeEach, afterEach } from 'mocha';
import { getDocument } from '../../../doc-mirror';
import * as jackIn from '../../../nrepl/jack-in';
import {
  ReplConnectSequence,
  ProjectTypes,
  CljsTypes,
} from '../../../nrepl/connect-sequence-types';
import * as outputWindow from '../../../repl-window/repl-window-doc';
import * as testUtil from './util';

suite('Load File Command Test', () => {
  const suite = 'Load File Command Test';
  const jackInHarness = new testUtil.JackInHarness(suite);
  let originalDestinations: any;

  const testFile = 'test.clj';
  const testFilePath = path.join(testUtil.testDataDir, testFile);
  const connectSequence: ReplConnectSequence = {
    projectType: ProjectTypes['deps.edn'],
    name: 'deps.edn',
    cljsType: CljsTypes.none,
    projectRootPath: [path.join(testUtil.testDataDir, '..')],
    menuSelections: { cljAliases: [] },
  };

  before(async () => {
    testUtil.showMessage(suite, 'suite starting!');
    await testUtil.ensureOutputDir(testUtil.testDataDir);
    const config = vscode.workspace.getConfiguration('calva');
    originalDestinations = config.inspect('outputDestinations')?.globalValue;
  });

  after(async () => {
    testUtil.log(suite, 'Suite cleanup: killing all jack-in processes');
    await jackIn.calvaJackout({ force: true });
    await testUtil.waitForJackOutComplete(suite);
    testUtil.showMessage(suite, 'suite done!');
  });

  beforeEach(async function () {
    this.timeout(60_000);
    await outputWindow.clearReplWindowDoc();
    jackInHarness.reset();
    await jackInHarness.disconnectAllClients();
  });

  afterEach(async () => {
    const config = vscode.workspace.getConfiguration('calva');
    await config.update(
      'outputDestinations',
      originalDestinations,
      vscode.ConfigurationTarget.Global
    );
  });

  async function setOutputDestinations(destination: string) {
    const config = vscode.workspace.getConfiguration('calva');
    await config.update(
      'outputDestinations',
      {
        evalResults: destination,
        evalOutput: destination,
        otherOutput: destination,
      },
      vscode.ConfigurationTarget.Global
    );
  }

  async function performJackIn(destination: 'terminal' | 'repl-window') {
    await setOutputDestinations(destination);
    if (destination === 'terminal') {
      await testUtil.openFile(testFilePath);
      await vscode.commands.executeCommand('calva.jackIn', {
        connectSequence,
        disableAutoSelect: true,
      });
      const clientKey = await jackInHarness.waitForNextClient();
      testUtil.log(suite, 'Waiting for jack-in to complete (terminal output mode)...');
      await testUtil.waitForSessionsReady(suite, clientKey);
    } else {
      await jackInHarness.jackInWithConnectSequence(testFilePath, connectSequence);
    }
  }

  async function getReplWindowText() {
    const replWindowDoc = await outputWindow.openReplWindowDoc();
    return getDocument(replWindowDoc).document.getText();
  }

  test('execute calva.loadFile with repl-window output and verify results', async function () {
    await performJackIn('repl-window');
    await testUtil.openFile(testFilePath);
    await vscode.commands.executeCommand('calva.loadFile');
    let text = await getReplWindowText();
    assert.ok(text.includes('; bar'), 'Output should contain evaluation result from first load');
    await testUtil.openFile(testFilePath);
    await vscode.commands.executeCommand('calva.loadFile');
    text = await getReplWindowText();
    const occurrences = (text.match(/; bar/g) || []).length;
    assert.ok(
      occurrences >= 2,
      `Expected "; bar" to appear at least twice, but found ${occurrences} times.`
    );
  });

  test('execute calva.loadFile twice with terminal output', async function () {
    await performJackIn('terminal');
    await testUtil.openFile(testFilePath);
    await vscode.commands.executeCommand('calva.loadFile');
    await testUtil.openFile(testFilePath);
    const loadFilePromise = vscode.commands.executeCommand('calva.loadFile');
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('calva.loadFile hung on second execution')), 5000)
    );
    await Promise.race([loadFilePromise, timeoutPromise]);
  });
});
