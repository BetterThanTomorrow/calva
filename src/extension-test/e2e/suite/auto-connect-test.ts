import * as assert from 'assert';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as mocha from 'mocha';
import * as path from 'path';
import * as vscode from 'vscode';
import * as connector from '../../../connector';
import * as clientRegistry from '../../../nrepl/client-registry';
import * as sessionRegistry from '../../../nrepl/session-registry';
import * as testUtil from './util';

suite('Auto-connect suite', () => {
  const suiteName = 'Auto-connect';
  let originalAutoConnectRepl: boolean | undefined;
  let originalCustomSequences: any;
  let bbProcess: cp.ChildProcessWithoutNullStreams | undefined;

  const bbMiniDir = path.join(testUtil.testDataDir, 'bb-mini');
  const bbPortFile = path.join(bbMiniDir, '.nrepl-port');
  const bbMini2Dir = path.join(testUtil.testDataDir, 'bb-mini2');
  const bbPortFile2 = path.join(bbMini2Dir, '.nrepl-port');
  const workspaceRoot = testUtil.testDataDir;

  async function stopBbProcess(): Promise<void> {
    if (bbProcess && !bbProcess.killed) {
      bbProcess.kill();
      await testUtil.waitForCondition(
        () => bbProcess === undefined || bbProcess.killed || bbProcess.exitCode !== null,
        5000,
        50,
        'Timed out waiting for bbProcess to exit'
      );
      bbProcess = undefined;
    }
  }

  function cleanPortFiles(): void {
    for (const file of [bbPortFile, bbPortFile2]) {
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
        } catch {
          // ignore
        }
      }
    }
  }

  mocha.before(() => {
    testUtil.showMessage(suiteName, 'suite starting!');
    const config = vscode.workspace.getConfiguration('calva');
    originalAutoConnectRepl = config.inspect<boolean>('autoConnectRepl')?.globalValue;
    originalCustomSequences = config.inspect('replConnectSequences')?.globalValue;
  });

  mocha.after(async () => {
    await stopBbProcess();
    cleanPortFiles();
    const config = vscode.workspace.getConfiguration('calva');
    await config.update(
      'autoConnectRepl',
      originalAutoConnectRepl,
      vscode.ConfigurationTarget.Global
    );
    await config.update(
      'replConnectSequences',
      originalCustomSequences,
      vscode.ConfigurationTarget.Global
    );
    await connector.disconnect({ disconnectAll: true });
    testUtil.showMessage(suiteName, 'suite done!');
  });

  mocha.beforeEach(async () => {
    await connector.disconnect({ disconnectAll: true });
  });

  mocha.afterEach(async () => {
    await stopBbProcess();
    cleanPortFiles();
    await connector.disconnect({ disconnectAll: true });
  });

  test('shouldAutoConnect is false when autoConnectRepl is disabled', async () => {
    const config = vscode.workspace.getConfiguration('calva');
    await config.update('autoConnectRepl', false, vscode.ConfigurationTarget.Global);

    const shouldAuto = await connector.shouldAutoConnect();
    assert.strictEqual(
      shouldAuto,
      false,
      'shouldAutoConnect should be false when setting is false'
    );
  });

  test('shouldAutoConnect is false when autoConnectRepl is true but no port file exists', async () => {
    const config = vscode.workspace.getConfiguration('calva');
    await config.update('autoConnectRepl', true, vscode.ConfigurationTarget.Global);

    const shouldAuto = await connector.shouldAutoConnect();
    assert.strictEqual(
      shouldAuto,
      false,
      'shouldAutoConnect should be false when no port file exists'
    );
  });

  test('shouldAutoConnect ignores port files of inapplicable project types (issue #3278)', async () => {
    const config = vscode.workspace.getConfiguration('calva');
    await config.update('autoConnectRepl', true, vscode.ConfigurationTarget.Global);

    // Create a foreign port file (e.g. .joyride/.nrepl-port) in workspace root
    const foreignDir = path.join(workspaceRoot, '.joyride');
    const foreignPortFile = path.join(foreignDir, '.nrepl-port');
    fs.mkdirSync(foreignDir, { recursive: true });
    fs.writeFileSync(foreignPortFile, '12345');

    try {
      const shouldAuto = await connector.shouldAutoConnect();
      assert.strictEqual(
        shouldAuto,
        false,
        'shouldAutoConnect should remain false despite foreign port files'
      );
    } finally {
      if (fs.existsSync(foreignPortFile)) {
        fs.unlinkSync(foreignPortFile);
      }
    }
  });

  test('shouldAutoConnect is true when port file exists for autoSelectForConnect sequence and connects without prompt', async function () {
    this.timeout(30_000);

    const bbExe = testUtil.getExecutablePath('bb') || 'bb';
    const knownPort = '16688';
    const config = vscode.workspace.getConfiguration('calva');
    await config.update('autoConnectRepl', true, vscode.ConfigurationTarget.Global);
    await config.update(
      'replConnectSequences',
      [
        {
          name: 'Babashka AutoConnect Test',
          projectType: 'babashka',
          autoSelectForConnect: true,
          projectRootPath: ['integration-test', 'bb-mini'],
          nReplPortFile: ['.nrepl-port'],
          cljsType: 'none',
        },
      ],
      vscode.ConfigurationTarget.Global
    );

    // Start a Babashka REPL server on a known port
    let serverStarted = false;
    bbProcess = cp.spawn(bbExe, ['nrepl-server', knownPort], {
      cwd: bbMiniDir,
      stdio: 'pipe',
    });

    bbProcess.stdout.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes(`Started nREPL server at`)) {
        serverStarted = true;
      }
    });

    // Write the port file for the test
    fs.writeFileSync(bbPortFile, knownPort);

    // Wait for the bb server to be listening
    await testUtil.waitForCondition(
      () => serverStarted,
      5000,
      50,
      'Timed out waiting for Babashka nREPL server to start'
    );

    const shouldAuto = await connector.shouldAutoConnect();
    assert.strictEqual(
      shouldAuto,
      true,
      'shouldAutoConnect should be true when the sequence port file exists'
    );

    // Connect via command (auto-connect mode)
    await vscode.commands.executeCommand('calva.connect');

    await testUtil.waitForCondition(
      () => clientRegistry.listClients().length === 1,
      10_000,
      100,
      'Timed out waiting for REPL client to connect'
    );

    const sessions = sessionRegistry.listSessions();
    assert.ok(sessions.length >= 1, 'Should have connected sessions');

    // Verify evaluation works in connected REPL
    const primarySession = sessionRegistry.getSession(sessions[0].key);
    assert.ok(primarySession, 'Primary session should exist');
    const evalResult = await primarySession.eval('(+ 20 22)', 'user').value;
    assert.strictEqual(evalResult, '42', 'Evaluation in auto-connected REPL should succeed');
  });

  test('multiple autoSelectForConnect sequences: shouldAutoConnect checks the auto-selected sequence', async () => {
    const config = vscode.workspace.getConfiguration('calva');
    await config.update('autoConnectRepl', true, vscode.ConfigurationTarget.Global);
    await config.update(
      'replConnectSequences',
      [
        {
          name: 'First AutoConnect Seq',
          projectType: 'babashka',
          autoSelectForConnect: true,
          projectRootPath: ['integration-test', 'bb-mini'],
          nReplPortFile: ['.nrepl-port'],
          cljsType: 'none',
        },
        {
          name: 'Second AutoConnect Seq',
          projectType: 'babashka',
          autoSelectForConnect: true,
          projectRootPath: ['integration-test', 'bb-mini2'],
          nReplPortFile: ['.nrepl-port'],
          cljsType: 'none',
        },
      ],
      vscode.ConfigurationTarget.Global
    );

    // Case (a): first sequence has port file -> shouldAutoConnect is true
    fs.writeFileSync(bbPortFile, '16688');
    let shouldAuto = await connector.shouldAutoConnect();
    assert.strictEqual(
      shouldAuto,
      true,
      'shouldAutoConnect should be true when the first autoSelect sequence has port file'
    );

    // Case (b): first sequence port file missing, but second sequence has port file
    // The first auto-selected sequence (when no editor is open) is the candidate to connect.
    // Since its port file is missing, shouldAutoConnect is false (does not falsely connect to wrong sequence)
    fs.unlinkSync(bbPortFile);
    fs.writeFileSync(bbPortFile2, '16689');

    shouldAuto = await connector.shouldAutoConnect();
    assert.strictEqual(
      shouldAuto,
      false,
      'shouldAutoConnect should be false when the targeted first sequence has no port file'
    );
  });
});
