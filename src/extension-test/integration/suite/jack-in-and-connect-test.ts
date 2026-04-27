import * as assert from 'assert';
import * as mocha from 'mocha';
import * as path from 'path';
import * as testUtil from './util';
import * as util from '../../../utilities';
import * as clientRegistry from '../../../nrepl/client-registry';
import * as sessionRegistry from '../../../nrepl/session-registry';
import * as jackIn from '../../../nrepl/jack-in';
import * as vscode from 'vscode';
import * as outputWindow from '../../../repl-window/repl-window-doc';
import * as docMirror from '../../../doc-mirror';
import * as projectRoot from '../../../project-root';
import * as state from '../../../state';
import connector from '../../../connector';
import * as connectorModule from '../../../connector';
import * as connectTypes from '../../../nrepl/connect-types';
import * as connectSequence from '../../../nrepl/connectSequence';
import * as connectSequenceTypes from '../../../nrepl/connect-sequence-types';
import * as projectTypes from '../../../nrepl/project-types';
import * as config from '../../../config';
import * as output from '../../../results-output/output';
import * as outputDestinations from '../../../results-output/output-destinations';

suite('Jack-in and Connect suite', () => {
  const suite = 'Jack-in and Connect';
  let originalDestinations: any;

  mocha.before(async () => {
    testUtil.showMessage(suite, 'suite starting!');
    await testUtil.ensureOutputDir(testUtil.testDataDir);
    const config = vscode.workspace.getConfiguration('calva');
    originalDestinations = config.inspect('outputDestinations')?.globalValue;
  });

  mocha.after(async () => {
    // Ensure all REPL processes are killed at suite end to prevent orphaned Java processes
    // Use force=true because test harness shutdown is similar to VS Code deactivation
    testUtil.log(suite, 'Suite cleanup: killing all jack-in processes');
    await jackIn.calvaJackout({ force: true });
    await testUtil.waitForJackOutComplete(suite);
    testUtil.showMessage(suite, 'suite done!');
  });

  mocha.beforeEach(async () => {
    await setOutputDestinations('repl-window');
    await outputWindow.clearReplWindowDoc();
    resetConnectionTracking();
    await disconnectExistingClients();
  });

  mocha.afterEach(async () => {
    const config = vscode.workspace.getConfiguration('calva');
    await config.update(
      'outputDestinations',
      originalDestinations,
      vscode.ConfigurationTarget.Global
    );
  });

  test('start repl and connect (jack-in)', async function () {
    testUtil.log(suite, 'start repl and connect (jack-in)');

    const testFilePath = await startJackInProcedure(suite, 'calva.jackIn', 'deps.edn', 'test.clj');

    await loadAndAssert(suite, testFilePath, ['; bar', 'nil', 'clj꞉test꞉> ']);

    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    testUtil.log(suite, 'test.clj closed');
  });

  test('start repl and connect (jack-in) to Basilisp', async function () {
    testUtil.log(suite, 'start repl and connect (jack-in) to Basilisp');
    const basilispPath = config.getConfig().basilispPath;
    const executablePath = testUtil.getExecutablePath(basilispPath);

    if (executablePath === null && !testUtil.isCircleCI) {
      testUtil.log(suite, `Basilisp executable '${basilispPath}' not found, skipping test...`);
      this.skip();
    } else {
      testUtil.log(suite, `Basilisp executable found at ${executablePath}`);

      const testFilePath = await startJackInProcedure(
        suite,
        'calva.jackIn',
        'basilisp',
        '../projects/minimal-basilisp/src/test.lpy'
      );

      await loadAndAssert(suite, testFilePath, ['; bar', 'nil', 'basilisp꞉test꞉> ']);

      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
      testUtil.log(suite, 'test.lpy closed for Basilisp');
    }
  });

  test('Jack-in afterPrimaryReplConnectedCode can be a string', async () => {
    testUtil.log(suite, 'Reconnect: afterPrimaryReplConnectedCode (string)');
    const connectSequence: connectSequenceTypes.ReplConnectSequence = {
      projectType: connectSequenceTypes.ProjectTypes['deps.edn'],
      name: 'string-afterPrimaryReplConnectedCode',
      autoSelectForJackIn: true,
      afterPrimaryReplConnectedCode: '(println :hello :world!)',
      cljsType: connectSequenceTypes.CljsTypes.none,
    };
    await reconnectAndAssert(
      suite,
      'deps.edn',
      'test.clj',
      ['; :hello :world!', '; bar', 'nil', 'clj꞉test꞉> '],
      connectSequence
    );
  });

  test('Jack-in afterPrimaryReplConnectedCode can be an array', async () => {
    testUtil.log(suite, 'Reconnect: afterPrimaryReplConnectedCode (array)');
    const connectSequence: connectSequenceTypes.ReplConnectSequence = {
      projectType: connectSequenceTypes.ProjectTypes['deps.edn'],
      name: 'array-afterPrimaryReplConnectedCode',
      autoSelectForJackIn: true,
      afterPrimaryReplConnectedCode: ['(println :hello)', '(println :world!)'].join('\n'),
      cljsType: connectSequenceTypes.CljsTypes.none,
    };
    await reconnectAndAssert(
      suite,
      'deps.edn',
      'test.clj',
      ['; :hello', '; :world!', '; bar', 'nil', 'clj꞉test꞉> '],
      connectSequence
    );
  });

  test('Jack-in still accepts afterCLJReplJackInCode', async () => {
    testUtil.log(suite, 'Reconnect: afterCLJReplJackInCode');
    const connectSequence: connectSequenceTypes.ReplConnectSequence = {
      projectType: connectSequenceTypes.ProjectTypes['deps.edn'],
      name: 'legacy-afterCLJReplJackInCode',
      autoSelectForJackIn: true,
      afterCLJReplJackInCode: '(println :legacy :hook!)',
      cljsType: connectSequenceTypes.CljsTypes.none,
    };
    await reconnectAndAssert(
      suite,
      'deps.edn',
      'test.clj',
      ['; :legacy :hook!', '; bar', 'nil', 'clj꞉test꞉> '],
      connectSequence
    );
  });

  test('Jack-in works with auto-selected project type', async () => {
    testUtil.log(suite, 'Reconnect: auto-selected project type');

    const connectSequence: connectSequenceTypes.ReplConnectSequence = {
      projectType: connectSequenceTypes.ProjectTypes['deps.edn'],
      name: 'auto-select',
      autoSelectForJackIn: true,
      cljsType: connectSequenceTypes.CljsTypes.none,
    };
    await reconnectAndAssert(
      suite,
      'deps.edn',
      'test.clj',
      ['; bar', 'nil', 'clj꞉test꞉> '],
      connectSequence
    );
  });

  test('Copy Jack-in command line', async function () {
    testUtil.log('Copy Jack-in command line');

    await startJackInProcedure(suite, 'calva.copyJackInCommandToClipboard', 'deps.edn', 'test.clj');

    const cmdLine = await vscode.env.clipboard.readText();
    testUtil.log(suite, 'cmdLine', cmdLine);

    if (util.isWindows) {
      assert.ok(cmdLine.includes('deps.clj'));
    } else {
      assert.ok(cmdLine.includes('clojure'));
    }

    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    testUtil.log(suite, 'test.clj closed');
  });

  test('Copy Jack-in command line for projectless project (no deps.edn) #2976', async function () {
    testUtil.log(suite, 'Copy Jack-in command line for projectless project');

    // Use a directory that has no deps.edn to reproduce #2976
    const projectlessDir = path.join(testUtil.testDataDir, 'projectless');
    const testFilePath = path.join(projectlessDir, 'test.clj');
    await testUtil.openFile(testFilePath);
    testUtil.log(suite, 'projectless test.clj opened');

    const connectSequence: connectSequenceTypes.ReplConnectSequence = {
      name: 'Clojure (projectless)',
      projectType: connectSequenceTypes.ProjectTypes['clj-projectless'],
      cljsType: connectSequenceTypes.CljsTypes.none,
      projectRootPath: [projectlessDir],
    };

    // Clear clipboard so we can detect if command generation failed
    await vscode.env.clipboard.writeText('');

    await vscode.commands.executeCommand('calva.copyJackInCommandToClipboard', {
      connectSequence,
      disableAutoSelect: true,
    });

    const cmdLine = await vscode.env.clipboard.readText();
    testUtil.log(suite, 'projectless cmdLine', cmdLine);

    // Without the fix for #2976, cljCommandLine tries to read deps.edn
    // from the project root, which fails with ENOENT in a projectless
    // directory, leaving the clipboard empty.
    assert.ok(cmdLine.length > 0, 'Command line should have been generated');
    if (util.isWindows) {
      assert.ok(cmdLine.includes('deps.clj'), 'Should include deps.clj on Windows');
    } else {
      assert.ok(cmdLine.includes('clojure'), 'Should include clojure on non-Windows');
    }

    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    testUtil.log(suite, 'projectless test.clj closed');
  });

  test('Reconnection with different sequence name cleans up jack-in process', async function () {
    this.timeout(120_000);
    testUtil.log(suite, 'Reconnection: different sequence name, same session names');

    // First jack-in with Babashka (fast, lightweight)
    const sequence1: connectSequenceTypes.ReplConnectSequence = {
      projectType: connectSequenceTypes.ProjectTypes['babashka'],
      name: 'First Babashka Sequence',
      cljsType: connectSequenceTypes.CljsTypes.none,
      afterPrimaryReplConnectedCode: '(println "First connection")',
    };

    const testFile1 = 'bb-mini/test.clj';
    await startJackInProcedure(suite, 'calva.jackIn', undefined, testFile1, sequence1);

    // Wait for connection to complete
    await waitForResult(suite);
    testUtil.log(suite, 'First connection established');

    // Get first client info
    const clients1 = clientRegistry.listClients();
    assert.strictEqual(clients1.length, 1, 'Should have exactly one client after first jack-in');
    const firstClientKey = clients1[0].key;
    testUtil.log(suite, `First client key: ${firstClientKey}`);

    // Second jack-in with different sequence name but same base session name (bb)
    const sequence2: connectSequenceTypes.ReplConnectSequence = {
      projectType: connectSequenceTypes.ProjectTypes['babashka'],
      name: 'Second Babashka Sequence', // Different name!
      cljsType: connectSequenceTypes.CljsTypes.none,
      afterPrimaryReplConnectedCode: '(println "Second connection")',
    };

    await startJackInProcedure(suite, 'calva.jackIn', undefined, testFile1, sequence2);

    // Wait for second connection
    await waitForResult(suite);
    testUtil.log(suite, 'Second connection established');

    // Verify reconnection behavior
    const clients2 = clientRegistry.listClients();
    assert.strictEqual(
      clients2.length,
      1,
      'Should still have exactly one client after reconnection'
    );
    assert.notStrictEqual(
      clients2[0].key,
      firstClientKey,
      'Client key should be different (new client)'
    );

    // Verify session exists with expected name
    const sessions = sessionRegistry.listSessions();
    const sessionKeys = sessions.map((s) => s.key).sort();
    testUtil.log(suite, `Active sessions: ${sessionKeys.join(', ')}`);

    // Should have bb session (the base session name)
    assert.strictEqual(sessions.length, 1, 'Should have exactly one session');
    assert.ok(
      sessionKeys.some((k) => k.startsWith('bb')),
      'Should have a bb session'
    );

    testUtil.log(suite, 'Reconnection test completed successfully');
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  test('Manual reconnect preserves jack-in process and retains session names', async function () {
    this.timeout(120_000);
    testUtil.log(suite, 'Manual reconnect: two jack-ins, then reconnect first');

    // First jack-in with Babashka (fast, lightweight)
    const sequence1: connectSequenceTypes.ReplConnectSequence = {
      projectType: connectSequenceTypes.ProjectTypes['babashka'],
      name: 'First Manual Reconnect Test',
      cljsType: connectSequenceTypes.CljsTypes.none,
    };

    const testFile1 = 'bb-mini/test.clj';
    await startJackInProcedure(suite, 'calva.jackIn', undefined, testFile1, sequence1);
    await waitForResult(suite);
    testUtil.log(suite, 'First jack-in complete');

    const clients1 = clientRegistry.listClients();
    assert.strictEqual(clients1.length, 1, 'Should have one client after first jack-in');
    const firstClientKey = clients1[0].key;
    const firstClientHost = clients1[0].host;
    const firstClientPort = clients1[0].port;

    const sessions1 = sessionRegistry.listSessions();
    const firstSessionKeys = sessions1.map((s) => s.key).sort();
    testUtil.log(suite, `First jack-in sessions: ${firstSessionKeys.join(', ')}`);
    assert.strictEqual(sessions1.length, 1, 'Should have 1 session after first jack-in');

    // Get jack-in process count before second jack-in
    const jackInProcessesBefore = jackIn.listJackInProcesses();
    const firstClientProcesses = jackInProcessesBefore.filter(
      (p) => p.clientKey === firstClientKey
    );
    assert.strictEqual(
      firstClientProcesses.length,
      1,
      'Should have one jack-in process for first client'
    );

    // Second jack-in to bb-mini2 (different project root to avoid reconnection during jack-in)
    const sequence2: connectSequenceTypes.ReplConnectSequence = {
      projectType: connectSequenceTypes.ProjectTypes['babashka'],
      name: 'Second Manual Reconnect Test',
      cljsType: connectSequenceTypes.CljsTypes.none,
    };

    const testFile2 = 'bb-mini2/test.clj';
    await startJackInProcedure(suite, 'calva.jackIn', undefined, testFile2, sequence2);
    await waitForResult(suite);
    testUtil.log(suite, 'Second jack-in complete');

    const clients2 = clientRegistry.listClients();
    assert.strictEqual(clients2.length, 2, 'Should have two clients after second jack-in');

    const sessions2 = sessionRegistry.listSessions();
    const allSessionKeys = sessions2.map((s) => s.key).sort();
    testUtil.log(suite, `All sessions after second jack-in: ${allSessionKeys.join(', ')}`);
    assert.strictEqual(sessions2.length, 2, 'Should have 2 sessions total (1 per connection)');

    // Now manually reconnect to the first REPL (same port, same project root)
    testUtil.log(suite, 'Reconnecting to first REPL...');

    // Open the file to set the correct project root context
    const firstProjectFilePath = path.join(testUtil.testDataDir, testFile1);
    const firstProjectRootPath = path.dirname(firstProjectFilePath);
    await testUtil.openFile(firstProjectFilePath);
    const reconnectSequence = {
      ...sequence1,
      projectRootPath: [firstProjectRootPath],
    };
    await state.initProjectDir(connectTypes.ConnectType.Connect, reconnectSequence, true);

    // Connect directly using the same sequence, host, and port as the first jack-in
    await connectorModule.connect(
      reconnectSequence,
      true,
      firstClientHost,
      String(firstClientPort)
    );
    const reconnectedClientKey = await waitForNextClient(suite);
    await waitForSessionsReady(suite, reconnectedClientKey);

    testUtil.log(suite, 'Reconnection complete');

    // Verify: Still have 2 clients
    const clients3 = clientRegistry.listClients();
    testUtil.log(
      suite,
      `Clients after reconnect: ${clients3
        .map((c) => `${c.key} (${c.connectSequenceName})`)
        .join(', ')}`
    );
    assert.strictEqual(clients3.length, 2, 'Should still have two clients after reconnect');

    // Verify: Still have 2 sessions total
    const sessions3 = sessionRegistry.listSessions();
    const allSessionKeys3 = sessions3.map((s) => s.key).sort();
    testUtil.log(suite, `All sessions after reconnect: ${allSessionKeys3.join(', ')}`);
    assert.strictEqual(sessions3.length, 2, 'Should still have 2 sessions after reconnect');

    // Verify: The reconnected sessions preserved their original names (bb)
    // and the second jack-in session is still there (bb:2)
    assert.ok(allSessionKeys3.includes('bb'), 'Should have bb session (from reconnection)');
    assert.ok(allSessionKeys3.includes('bb:2'), 'Should have bb:2 session (from second jack-in)');

    // Verify: We can successfully evaluate code in the reconnected REPL
    // This proves the jack-in terminal is still running and the connection works
    testUtil.log(suite, 'Verifying reconnected REPL is functional...');
    const reconnectedSession = sessionRegistry.getSession('bb');
    assert.ok(reconnectedSession, 'Should have reconnected bb session');
    const evalResult = await reconnectedSession.eval('(+ 1 2)', 'user').value;
    assert.strictEqual(`${evalResult}`.trim(), '3', 'Reconnected bb session should evaluate code');

    testUtil.log(suite, 'Manual reconnect test completed successfully - REPL still functional');
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });
});

function appearInOrder(needle: string[], haystack: string[]) {
  let lastIndex = -1;
  return needle.every((str) => {
    const currentIndex = haystack.slice(lastIndex + 1).indexOf(str);
    if (currentIndex !== -1) {
      lastIndex += currentIndex + 1;
      return true;
    }
    return false;
  });
}

let lastSeenClientConnectedAt = 0;
let lastJackInDoneCount = 0;

async function loadAndAssert(
  suite: string,
  testFilePath: string,
  needle: string[],
  options?: { waitForJackInOutput?: boolean }
) {
  await waitForResult(suite, options);

  await vscode.workspace.openTextDocument(testFilePath).then((doc) =>
    vscode.window.showTextDocument(doc, {
      preserveFocus: false,
    })
  );
  testUtil.log(suite, 'opened test.clj document again');

  await vscode.commands.executeCommand('calva.loadFile');
  let haystack: string[] = [];
  await testUtil.waitForCondition(
    async () => {
      const replWindowDoc = await outputWindow.openReplWindowDoc();
      haystack = docMirror.getDocument(replWindowDoc).document.getText().split(/\r?\n/);
      return appearInOrder(needle, haystack);
    },
    10_000,
    50,
    `Timed out waiting for expected REPL-window output: ${JSON.stringify(needle)}`
  );
  assert.ok(
    appearInOrder(needle, haystack),
    `Expected output to contain: ${JSON.stringify(needle)}\n, but got: ${JSON.stringify(
      haystack
    )}\n`
  );
}

async function waitForResult(suite: string, options?: { waitForJackInOutput?: boolean }) {
  const clientKey = await waitForNextClient(suite);
  if (options?.waitForJackInOutput ?? true) {
    await waitForJackInCompletion(suite);
  }
  await waitForSessionsReady(suite, clientKey);
  testUtil.log(suite, 'connected to repl');

  return docMirror.getDocument(await outputWindow.openReplWindowDoc());
}

async function waitForNextClient(suite: string): Promise<string> {
  const client = await testUtil.waitForNewClient(suite, lastSeenClientConnectedAt);
  lastSeenClientConnectedAt = client.connectedAt;
  return client.key;
}

async function waitForJackInCompletion(suite: string) {
  if (
    !outputDestinations
      .normalizeDestinations(output.getDestinationConfiguration().otherOutput)
      .includes('repl-window')
  ) {
    testUtil.log(
      suite,
      'Skipping REPL-window jack-in completion wait because other output is not routed there'
    );
    return;
  }
  lastJackInDoneCount = await testUtil.waitForJackInCompletionCount(suite, lastJackInDoneCount);
}

async function setOutputDestinations(destination: output.OutputDestination) {
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

async function startJackInProcedure(
  suite: string,
  cmdId: string,
  projectType: string | undefined,
  testFile: string,
  connectSequenceOverride?: connectSequenceTypes.ReplConnectSequence
) {
  const { testFilePath, connectSequence } = await openTestFileAndBuildSequence(
    suite,
    projectType,
    testFile,
    connectSequenceOverride
  );

  if (cmdId === 'calva.jackIn' || cmdId === 'calva.copyJackInCommandToClipboard') {
    await vscode.commands.executeCommand(cmdId, { connectSequence, disableAutoSelect: true });
  } else {
    await vscode.commands.executeCommand(cmdId);
  }

  return testFilePath;
}

async function reconnectAndAssert(
  suite: string,
  projectType: string | undefined,
  testFile: string,
  needle: string[],
  connectSequenceOverride?: connectSequenceTypes.ReplConnectSequence
) {
  await disconnectExistingClients();
  resetConnectionTracking();

  const { testFilePath, connectSequence } = await openTestFileAndBuildSequence(
    suite,
    projectType,
    testFile,
    connectSequenceOverride
  );

  await connectorModule.connect(connectSequence, true);

  await loadAndAssert(suite, testFilePath, needle, { waitForJackInOutput: false });
  await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  testUtil.log(suite, `${path.basename(testFilePath)} closed after reconnect`);
}

async function openTestFileAndBuildSequence(
  suite: string,
  projectType: string | undefined,
  testFile: string,
  connectSequenceOverride?: connectSequenceTypes.ReplConnectSequence
) {
  const testFilePath = path.join(testUtil.testDataDir, testFile);
  await testUtil.openFile(testFilePath);
  testUtil.log(suite, `${testFile} opened for project type ${projectType}`);

  const candidateRoots = await projectRoot.findProjectRoots();
  const projectRootUri =
    projectRoot.findClosestParent(vscode.window.activeTextEditor?.document.uri, candidateRoots) ??
    vscode.workspace.workspaceFolders?.[0]?.uri ??
    vscode.Uri.file(testUtil.testDataDir);

  const connectSequence =
    connectSequenceOverride !== undefined
      ? { ...connectSequenceOverride, projectRootPath: [projectRootUri.fsPath] }
      : buildConnectSequence(projectType, projectRootUri);

  return { testFilePath, connectSequence };
}

function buildConnectSequence(
  projectType: string | undefined,
  projectRootUri: vscode.Uri
): connectSequenceTypes.ReplConnectSequence {
  const configuredSequences = config.getConfig().replConnectSequences ?? [];
  const defaultSequences = connectSequence.getConnectSequences(projectTypes.getAllProjectTypes());
  const sequences = configuredSequences.concat(defaultSequences);

  const sequenceFromProjectType = projectType
    ? sequences.find(
        (sequence) => sequence.projectType === projectType || sequence.name === projectType
      )
    : sequences[0];

  const effectiveProjectType = (projectType ??
    sequenceFromProjectType?.projectType ??
    'deps.edn') as connectSequenceTypes.ReplConnectSequence['projectType'];
  const baseSequence =
    sequenceFromProjectType ??
    ({
      name: effectiveProjectType,
      projectType: effectiveProjectType,
      cljsType: connectSequenceTypes.CljsTypes.none,
    } as connectSequenceTypes.ReplConnectSequence);

  return {
    ...baseSequence,
    projectRootPath: [projectRootUri.fsPath],
    cljsType: baseSequence.cljsType ?? connectSequenceTypes.CljsTypes.none,
  };
}

async function waitForSessionsReady(suite: string, clientKey: string): Promise<void> {
  await testUtil.waitForSessionsReady(suite, clientKey);
}

async function disconnectExistingClients(): Promise<void> {
  const clients = clientRegistry.listClients();
  for (const client of clients) {
    try {
      await connector.disconnect({ clientKey: client.key });
    } catch {
      // Ignore errors during cleanup
    }
  }
}

function resetConnectionTracking(): void {
  lastSeenClientConnectedAt = 0;
  lastJackInDoneCount = 0;
}
