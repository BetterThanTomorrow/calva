import * as vscode from 'vscode';
import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { before, after, beforeEach, afterEach } from 'mocha';
import * as jackIn from '../../../nrepl/jack-in';
import {
  ReplConnectSequence,
  ProjectTypes,
  CljsTypes,
} from '../../../nrepl/connect-sequence-types';
import * as outputWindow from '../../../repl-window/repl-window-doc';
import * as testUtil from './util';

suite('File Output Destination Test', () => {
  const suite = 'File Output Destination';
  const jackInHarness = new testUtil.JackInHarness(suite);
  let originalDestinations: any;
  let tmpDir: string;

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
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'calva-file-output-test-'));
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
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  async function setOutputDestinations(destinations: {
    evalResults: unknown;
    evalOutput: unknown;
    otherOutput: unknown;
  }) {
    const config = vscode.workspace.getConfiguration('calva');
    await config.update('outputDestinations', destinations, vscode.ConfigurationTarget.Global);
  }

  async function jackInWithTerminal() {
    await setOutputDestinations({
      evalResults: 'terminal',
      evalOutput: 'terminal',
      otherOutput: 'terminal',
    });
    await testUtil.openFile(testFilePath);
    await vscode.commands.executeCommand('calva.jackIn', {
      connectSequence,
      disableAutoSelect: true,
    });
    const clientKey = await jackInHarness.waitForNextClient();
    await testUtil.waitForSessionsReady(suite, clientKey);
  }

  async function waitForFileContent(
    filePath: string,
    predicate: (content: string) => boolean,
    timeoutMs = 5000
  ): Promise<string> {
    return testUtil.waitForValue(
      () => {
        if (!fs.existsSync(filePath)) {
          return undefined;
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        return predicate(content) ? content : undefined;
      },
      timeoutMs,
      100,
      `Timed out waiting for file content at ${filePath}`
    );
  }

  test('eval result written to file destination', async function () {
    this.timeout(120_000);
    await jackInWithTerminal();

    const outputFile = path.join(tmpDir, 'eval-results.txt');
    await setOutputDestinations({
      evalResults: ['terminal', outputFile],
      evalOutput: 'terminal',
      otherOutput: 'terminal',
    });

    await testUtil.openFile(testFilePath);
    await vscode.commands.executeCommand('calva.loadFile');

    const content = await waitForFileContent(outputFile, (c) => c.includes('bar'));

    // Should contain result without ANSI escape sequences
    assert.ok(content.includes('bar'), `Expected file to contain "bar", got: ${content}`);
    const esc = String.fromCharCode(0x1b);
    const csi = String.fromCharCode(0x9b);
    assert.ok(
      !content.includes(esc) && !content.includes(csi),
      'File output should not contain ANSI escape sequences'
    );
  });

  test('eval output (stdout) written to file destination', async function () {
    this.timeout(120_000);
    await jackInWithTerminal();

    const outputFile = path.join(tmpDir, 'eval-output.txt');
    await setOutputDestinations({
      evalResults: 'terminal',
      evalOutput: ['terminal', outputFile],
      otherOutput: 'terminal',
    });

    await testUtil.openFile(testFilePath);
    await vscode.commands.executeCommand('calva.loadFile');

    const content = await waitForFileContent(outputFile, (c) => c.includes('hello'));

    assert.ok(content.includes('hello'), `Expected file to contain "hello", got: ${content}`);
  });

  test('file auto-created with parent directories', async function () {
    this.timeout(120_000);
    await jackInWithTerminal();

    const outputFile = path.join(tmpDir, 'sub', 'dir', 'output.txt');
    await setOutputDestinations({
      evalResults: ['terminal', outputFile],
      evalOutput: 'terminal',
      otherOutput: 'terminal',
    });

    await testUtil.openFile(testFilePath);
    await vscode.commands.executeCommand('calva.loadFile');

    await waitForFileContent(outputFile, (c) => c.length > 0);
    assert.ok(fs.existsSync(outputFile), `Expected file to be created at ${outputFile}`);
  });

  test('multiple appends accumulate in file', async function () {
    this.timeout(120_000);
    await jackInWithTerminal();

    const outputFile = path.join(tmpDir, 'accumulated.txt');
    await setOutputDestinations({
      evalResults: ['terminal', outputFile],
      evalOutput: 'terminal',
      otherOutput: 'terminal',
    });

    await testUtil.openFile(testFilePath);

    // Load file twice to get two results
    await vscode.commands.executeCommand('calva.loadFile');
    await waitForFileContent(outputFile, (c) => c.includes('bar'));

    await vscode.commands.executeCommand('calva.loadFile');
    // Wait for two occurrences of the result
    const content = await waitForFileContent(
      outputFile,
      (c) => (c.match(/bar/g) || []).length >= 2
    );

    const matches = content.match(/bar/g) || [];
    assert.ok(matches.length >= 2, `Expected at least 2 "bar" in file, got ${matches.length}`);
  });
});
