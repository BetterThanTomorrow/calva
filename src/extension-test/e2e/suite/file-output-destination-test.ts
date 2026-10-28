import * as vscode from 'vscode';
import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as mocha from 'mocha';
import * as jackIn from '../../../nrepl/jack-in';
import * as connectSequenceTypes from '../../../nrepl/connect-sequence-types';
import * as outputWindow from '../../../repl-window/repl-window-doc';
import * as evaluate from '../../../evaluate';
import * as replSession from '../../../nrepl/repl-session';
import * as calvaConfig from '../../../config';
import * as testUtil from './util';

suite('File Output Destination Test', () => {
  const suite = 'File Output Destination';
  const jackInHarness = new testUtil.JackInHarness(suite);
  let originalDestinations: any;
  let tmpDir: string;

  const testFile = 'test.clj';
  const testFilePath = path.join(testUtil.testDataDir, testFile);
  const connectSequence: connectSequenceTypes.ReplConnectSequence = {
    projectType: connectSequenceTypes.ProjectTypes['deps.edn'],
    name: 'deps.edn',
    cljsType: connectSequenceTypes.CljsTypes.none,
    projectRootPath: [path.join(testUtil.testDataDir, '..')],
    menuSelections: { cljAliases: [] },
  };

  mocha.before(async () => {
    testUtil.showMessage(suite, 'suite starting!');
    await testUtil.ensureOutputDir(testUtil.testDataDir);
    const config = vscode.workspace.getConfiguration('calva');
    originalDestinations = config.inspect('outputDestinations')?.globalValue;
  });

  mocha.after(async () => {
    testUtil.log(suite, 'Suite cleanup: killing all jack-in processes');
    await jackIn.calvaJackout({ force: true });
    await testUtil.waitForJackOutComplete(suite);
    testUtil.showMessage(suite, 'suite done!');
  });

  mocha.beforeEach(async function () {
    this.timeout(60_000);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'calva-file-output-test-'));
    await outputWindow.clearReplWindowDoc();
    jackInHarness.reset();
    await jackInHarness.disconnectAllClients();
  });

  mocha.afterEach(async () => {
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
    // Wait for config to be visible to readers (update resolves before readers see it)
    const expected = JSON.stringify(destinations);
    await testUtil.waitForCondition(
      () => {
        const current = vscode.workspace.getConfiguration('calva').get('outputDestinations');
        return JSON.stringify(current) === expected;
      },
      2000,
      50,
      'outputDestinations config update did not take effect'
    );
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

  async function setEvaluationSendCodeToOutputWindow(value: unknown) {
    const config = vscode.workspace.getConfiguration('calva');
    await config.update(
      'evaluationSendCodeToOutputWindow',
      value,
      vscode.ConfigurationTarget.Global
    );
    await testUtil.waitForCondition(
      () =>
        vscode.workspace.getConfiguration('calva').inspect('evaluationSendCodeToOutputWindow')
          ?.globalValue === value,
      2000,
      50,
      'evaluationSendCodeToOutputWindow config update did not take effect'
    );
  }

  /**
   * Evaluates code from the file at `filePath` with `calva.evaluationSendCodeToOutputWindow` on,
   * then off, and asserts that each result reaches `resultsFile`, and the code only with the echo on.
   */
  async function assertEvaluationFromAFile(filePath: string, resultsFile: string) {
    const editor = await testUtil.openFile(filePath);
    const echoSetting = vscode.workspace
      .getConfiguration('calva')
      .inspect('evaluationSendCodeToOutputWindow')?.globalValue;
    try {
      for (const [echo, message] of [
        [true, 'An evaluation from a file should echo its code with the echo on'],
        [false, 'An evaluation from a file should not echo its code with the echo off'],
      ] as const) {
        await setEvaluationSendCodeToOutputWindow(echo);
        const code = `(str "from-a-file-" "echo-${echo}")`;
        await evaluate.evaluateInCurrentEditor(editor, code, undefined, 'user', {});
        const content = await waitForFileContent(resultsFile, (c) =>
          c.includes(`"from-a-file-echo-${echo}"`)
        );
        assert.strictEqual(content.includes(code), echo, message);
      }
    } finally {
      await setEvaluationSendCodeToOutputWindow(echoSetting);
    }
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

    const content = await waitForFileContent(outputFile, (c) => c.includes('nil'));

    // Should contain result without ANSI escape sequences
    assert.ok(content.includes('nil'), `Expected file to contain "nil", got: ${content}`);
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

    const content = await waitForFileContent(outputFile, (c) => c.includes('bar'));

    assert.ok(content.includes('bar'), `Expected file to contain "bar", got: ${content}`);
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
    await waitForFileContent(outputFile, (c) => c.includes('nil'));

    await vscode.commands.executeCommand('calva.loadFile');
    // Wait for two occurrences of the result
    const content = await waitForFileContent(
      outputFile,
      (c) => (c.match(/nil/g) || []).length >= 2
    );

    const matches = content.match(/nil/g) || [];
    assert.ok(matches.length >= 2, `Expected at least 2 "nil" in file, got ${matches.length}`);
  });

  test('shared evaluation, and evaluation from a file with echo on and off, send to the destinations', async function () {
    this.timeout(120_000);
    await jackInWithTerminal();

    const resultsFile = path.join(tmpDir, 'shared-eval-results.txt');
    const outputFile = path.join(tmpDir, 'shared-eval-output.txt');
    await setOutputDestinations({
      evalResults: ['terminal', resultsFile],
      evalOutput: ['terminal', outputFile],
      otherOutput: 'terminal',
    });

    const session = replSession.getSession();
    const evaluationFile = 'calva-repl-input/shared-eval-test.clj';
    const evaluationOptions = {
      session,
      ns: 'user',
      filePath: evaluationFile,
      line: 4,
      column: 2,
      pprintOptions: calvaConfig.getConfig().prettyPrintingOptions,
      echoDestinations: [],
    };

    const evaluation = await evaluate.evaluateToOutputDestinations({
      ...evaluationOptions,
      code: '(def shared-eval-probe (do (println "shared-eval-stdout") :probed))',
    });
    assert.deepStrictEqual(evaluation, { value: "#'user/shared-eval-probe", ns: 'user' });
    await waitForFileContent(resultsFile, (c) => c.includes("#'user/shared-eval-probe"));
    await waitForFileContent(outputFile, (c) => c.includes('shared-eval-stdout'));

    const location = await session.eval(
      "(select-keys (meta #'user/shared-eval-probe) [:file :line :column])",
      'user'
    ).value;
    assert.strictEqual(location, `{:file "${evaluationFile}", :line 5, :column 3}`);

    const failed = await evaluate.evaluateToOutputDestinations({
      ...evaluationOptions,
      code: '(throw (ex-info "shared-eval-boom" {}))',
    });
    assert.ok('error' in failed, `Expected an error, got: ${JSON.stringify(failed)}`);
    await waitForFileContent(outputFile, (c) => c.includes('shared-eval-boom'));

    await assertEvaluationFromAFile(testFilePath, resultsFile);
  });
});
