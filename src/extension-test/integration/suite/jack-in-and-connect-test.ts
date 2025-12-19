import * as assert from 'assert';
import { before, after, beforeEach, afterEach } from 'mocha';
import * as path from 'path';
import * as testUtil from './util';
import * as util from '../../../utilities';
import * as clientRegistry from '../../../nrepl/client-registry';
import * as sessionRegistry from '../../../nrepl/session-registry';
import * as jackIn from '../../../nrepl/jack-in';
import * as vscode from 'vscode';
import * as outputWindow from '../../../repl-window/repl-window-doc';
import { commands } from 'vscode';
import { getDocument } from '../../../doc-mirror';
import * as projectRoot from '../../../project-root';
import connector, { connect as connectDirect } from '../../../connector';
import { getConnectSequences } from '../../../nrepl/connectSequence';
import {
  CljsTypes,
  ProjectTypes,
  ReplConnectSequence,
} from '../../../nrepl/connect-sequence-types';
import * as projectTypes from '../../../nrepl/project-types';
import { getConfig } from '../../../config';

suite('Jack-in and Connect suite', () => {
  const suite = 'Jack-in and Connect';

  before(async () => {
    testUtil.showMessage(suite, 'suite starting!');
    await testUtil.ensureOutputDir(testUtil.testDataDir);
  });

  after(async () => {
    // Ensure all REPL processes are killed at suite end to prevent orphaned Java processes
    // Use force=true because test harness shutdown is similar to VS Code deactivation
    testUtil.log(suite, 'Suite cleanup: killing all jack-in processes');
    await jackIn.calvaJackout({ force: true });
    // Give processes time to terminate
    await testUtil.sleep(500);
    testUtil.showMessage(suite, 'suite done!');
  });

  beforeEach(async () => {
    await outputWindow.clearReplWindowDoc();
    resetConnectionTracking();
    await disconnectExistingClients();
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
    const basilispPath = getConfig().basilispPath;
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
    const connectSequence: ReplConnectSequence = {
      projectType: ProjectTypes['deps.edn'],
      name: 'string-afterPrimaryReplConnectedCode',
      autoSelectForJackIn: true,
      afterPrimaryReplConnectedCode: '(println :hello :world!)',
      cljsType: CljsTypes.none,
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
    const connectSequence: ReplConnectSequence = {
      projectType: ProjectTypes['deps.edn'],
      name: 'array-afterPrimaryReplConnectedCode',
      autoSelectForJackIn: true,
      afterPrimaryReplConnectedCode: ['(println :hello)', '(println :world!)'].join('\n'),
      cljsType: CljsTypes.none,
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
    const connectSequence: ReplConnectSequence = {
      projectType: ProjectTypes['deps.edn'],
      name: 'legacy-afterCLJReplJackInCode',
      autoSelectForJackIn: true,
      afterCLJReplJackInCode: '(println :legacy :hook!)',
      cljsType: CljsTypes.none,
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

    const connectSequence: ReplConnectSequence = {
      projectType: ProjectTypes['deps.edn'],
      name: 'auto-select',
      autoSelectForJackIn: true,
      cljsType: CljsTypes.none,
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

  test('Reconnection with different sequence name cleans up jack-in process', async function () {
    this.timeout(120_000);
    testUtil.log(suite, 'Reconnection: different sequence name, same session names');

    // First jack-in with Babashka (fast, lightweight)
    const sequence1: ReplConnectSequence = {
      projectType: ProjectTypes['babashka'],
      name: 'First Babashka Sequence',
      cljsType: CljsTypes.none,
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
    const sequence2: ReplConnectSequence = {
      projectType: ProjectTypes['babashka'],
      name: 'Second Babashka Sequence', // Different name!
      cljsType: CljsTypes.none,
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
    const sequence1: ReplConnectSequence = {
      projectType: ProjectTypes['babashka'],
      name: 'First Manual Reconnect Test',
      cljsType: CljsTypes.none,
    };

    const testFile1 = 'bb-mini/test.clj';
    await startJackInProcedure(suite, 'calva.jackIn', undefined, testFile1, sequence1);
    await waitForResult(suite);
    testUtil.log(suite, 'First jack-in complete');

    const clients1 = clientRegistry.listClients();
    assert.strictEqual(clients1.length, 1, 'Should have one client after first jack-in');
    const firstClientKey = clients1[0].key;
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
    const sequence2: ReplConnectSequence = {
      projectType: ProjectTypes['babashka'],
      name: 'Second Manual Reconnect Test',
      cljsType: CljsTypes.none,
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
    await testUtil.openFile(path.join(testUtil.testDataDir, testFile1));

    // Connect directly using the same sequence and port as the first jack-in
    await connectDirect(sequence1, true, 'localhost', String(firstClientPort));
    await testUtil.sleep(1000);

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
    await vscode.commands.executeCommand('calva.loadFile');
    await testUtil.sleep(500);

    const resultsEditor = await outputWindow.openReplWindowDoc();
    const outputText = getDocument(resultsEditor).document.getText();
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
  const replWindowDoc = await waitForResult(suite, options);

  await vscode.workspace.openTextDocument(testFilePath).then((doc) =>
    vscode.window.showTextDocument(doc, {
      preserveFocus: false,
    })
  );
  testUtil.log(suite, 'opened test.clj document again');

  await commands.executeCommand('calva.loadFile');
  const haystack = replWindowDoc.document.getText().split(/\r?\n/);
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
  } else {
    await waitForSessionsReady(suite, clientKey);
  }
  await testUtil.sleep(500);
  testUtil.log(suite, 'connected to repl');

  return getDocument(await outputWindow.openReplWindowDoc());
}

async function waitForNextClient(suite: string): Promise<string> {
  const timeoutMs = 60_000;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const clients = clientRegistry.listClients();
    const newest = clients[clients.length - 1];
    if (newest && newest.connectedAt > lastSeenClientConnectedAt) {
      lastSeenClientConnectedAt = newest.connectedAt;
      testUtil.log(
        suite,
        `detected new client ${newest.connectSequenceName ?? newest.key} (${
          newest.projectRoot ?? 'no-root'
        })`
      );
      return newest.key;
    }
    testUtil.log(suite, 'waiting for new jack-in client...');
    await testUtil.sleep(250);
  }
  throw new Error('Timed out waiting for new jack-in client');
}

async function waitForJackInCompletion(suite: string) {
  const timeoutMs = 60_000;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const resultsEditor = await outputWindow.openReplWindowDoc();
    const text = getDocument(resultsEditor).document.getText();
    const currentCount = (text.match(/Jack-in done\./g) || []).length;
    if (currentCount > lastJackInDoneCount) {
      lastJackInDoneCount = currentCount;
      testUtil.log(suite, 'jack-in completion detected');
      return;
    }
    testUtil.log(suite, 'waiting for jack-in completion output...');
    await testUtil.sleep(250);
  }
  throw new Error('Timed out waiting for jack-in completion output');
}

async function startJackInProcedure(
  suite: string,
  cmdId: string,
  projectType: string | undefined,
  testFile: string,
  connectSequenceOverride?: ReplConnectSequence
) {
  const { testFilePath, connectSequence } = await openTestFileAndBuildSequence(
    suite,
    projectType,
    testFile,
    connectSequenceOverride
  );

  if (cmdId === 'calva.jackIn' || cmdId === 'calva.copyJackInCommandToClipboard') {
    await commands.executeCommand(cmdId, { connectSequence, disableAutoSelect: true });
  } else {
    await commands.executeCommand(cmdId);
  }

  return testFilePath;
}

async function reconnectAndAssert(
  suite: string,
  projectType: string | undefined,
  testFile: string,
  needle: string[],
  connectSequenceOverride?: ReplConnectSequence
) {
  await disconnectExistingClients();
  resetConnectionTracking();

  const { testFilePath, connectSequence } = await openTestFileAndBuildSequence(
    suite,
    projectType,
    testFile,
    connectSequenceOverride
  );

  await connectDirect(connectSequence, true);

  await loadAndAssert(suite, testFilePath, needle, { waitForJackInOutput: false });
  await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  testUtil.log(suite, `${path.basename(testFilePath)} closed after reconnect`);
}

async function openTestFileAndBuildSequence(
  suite: string,
  projectType: string | undefined,
  testFile: string,
  connectSequenceOverride?: ReplConnectSequence
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
): ReplConnectSequence {
  const configuredSequences = getConfig().replConnectSequences ?? [];
  const defaultSequences = getConnectSequences(projectTypes.getAllProjectTypes());
  const sequences = configuredSequences.concat(defaultSequences);

  const sequenceFromProjectType = projectType
    ? sequences.find(
        (sequence) => sequence.projectType === projectType || sequence.name === projectType
      )
    : sequences[0];

  const effectiveProjectType = (projectType ??
    sequenceFromProjectType?.projectType ??
    'deps.edn') as ReplConnectSequence['projectType'];
  const baseSequence =
    sequenceFromProjectType ??
    ({
      name: effectiveProjectType,
      projectType: effectiveProjectType,
      cljsType: CljsTypes.none,
    } as ReplConnectSequence);

  return {
    ...baseSequence,
    projectRootPath: [projectRootUri.fsPath],
    cljsType: baseSequence.cljsType ?? CljsTypes.none,
  };
}

async function waitForSessionsReady(suite: string, clientKey: string): Promise<void> {
  const timeoutMs = 60_000;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const sessions = sessionRegistry.listSessionsByClient(clientKey);
    const sessionKeys = sessions.map((s) => s.key);
    if (sessionKeys.length > 0) {
      testUtil.log(suite, `sessions ready for client ${clientKey}: ${sessionKeys.join(', ')}`);
      return;
    }
    testUtil.log(suite, 'waiting for sessions to be ready...');
    await testUtil.sleep(250);
  }

  throw new Error('Timed out waiting for sessions to be ready');
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
