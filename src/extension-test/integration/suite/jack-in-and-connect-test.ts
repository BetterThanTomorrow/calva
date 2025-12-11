import * as assert from 'assert';
import { before, after, beforeEach } from 'mocha';
import * as path from 'path';
import * as testUtil from './util';
import * as util from '../../../utilities';
import * as clientRegistry from '../../../nrepl/client-registry';
import * as sessionRegistry from '../../../nrepl/session-registry';
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

  after(() => {
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

    // First jack-in with "deps.edn + ClojureScript built-in for node" sequence
    const sequence1: ReplConnectSequence = {
      projectType: ProjectTypes['deps.edn'],
      name: 'First ClojureScript Node Sequence',
      cljsType: CljsTypes['ClojureScript built-in for node'],
      afterPrimaryReplConnectedCode: '(println "First connection")',
    };

    const testFile1 = '../projects/cljs-only/src/hello_world/core.cljs';
    await startJackInProcedure(suite, 'calva.jackIn', undefined, testFile1, sequence1);

    // Wait for connection to complete
    await waitForResult(suite);
    testUtil.log(suite, 'First connection established');

    // Get first client info
    const clients1 = clientRegistry.listClients();
    assert.strictEqual(clients1.length, 1, 'Should have exactly one client after first jack-in');
    const firstClientKey = clients1[0].key;
    testUtil.log(suite, `First client key: ${firstClientKey}`);

    // Second jack-in with different sequence name but same base session names (clj, cljs)
    const sequence2: ReplConnectSequence = {
      projectType: ProjectTypes['deps.edn'],
      name: 'Second ClojureScript Node Sequence', // Different name!
      cljsType: CljsTypes['ClojureScript built-in for node'],
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

    // Verify sessions exist and use the expected names
    const sessions = sessionRegistry.listSessions();
    const sessionKeys = sessions.map((s) => s.key).sort();
    testUtil.log(suite, `Active sessions: ${sessionKeys.join(', ')}`);

    // Should have clj and cljs sessions (the base session names, possibly with suffix)
    assert.ok(
      sessionKeys.some((k) => k.startsWith('clj')),
      'Should have a clj session'
    );
    assert.ok(
      sessionKeys.some((k) => k.startsWith('cljs')),
      'Should have a cljs session'
    );

    testUtil.log(suite, 'Reconnection test completed successfully');
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
