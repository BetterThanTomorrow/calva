import * as assert from 'assert';
import { before, after, beforeEach } from 'mocha';
import * as path from 'path';
import * as testUtil from './util';
import * as util from '../../../utilities';
import * as clientRegistry from '../../../nrepl/client-registry';
import * as vscode from 'vscode';
import * as outputWindow from '../../../repl-window/repl-window-doc';
import { commands } from 'vscode';
import { getDocument } from '../../../doc-mirror';
import * as projectRoot from '../../../project-root';
import { getConnectSequences } from '../../../nrepl/connectSequence';
import {
  CljsTypes,
  ProjectTypes,
  ReplConnectSequence,
} from '../../../nrepl/connect-sequence-types';
import * as projectTypes from '../../../nrepl/project-types';
import { getConfig } from '../../../config';

suite('Jack-in suite', () => {
  const suite = 'Jack-in';

  before(async () => {
    testUtil.showMessage(suite, 'suite starting!');
    await testUtil.ensureOutputDir(testUtil.testDataDir);
  });

  after(() => {
    testUtil.showMessage(suite, 'suite done!');
  });

  beforeEach(async () => {
    await outputWindow.clearReplWindowDoc();
    lastJackInDoneCount = 0;
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
    testUtil.log(suite, 'Jack-in afterPrimaryReplConnectedCode can be a string');
    const connectSequence: ReplConnectSequence = {
      projectType: ProjectTypes['deps.edn'],
      name: 'string-afterPrimaryReplConnectedCode',
      autoSelectForJackIn: true,
      projectRootPath: ['.'],
      afterPrimaryReplConnectedCode: '(println :hello :world!)',
      cljsType: CljsTypes.none,
    };
    const testFilePath = await startJackInProcedure(
      suite,
      'calva.jackIn',
      'deps.edn',
      'test.clj',
      connectSequence
    );
    await loadAndAssert(suite, testFilePath, ['; :hello :world!', '; bar', 'nil', 'clj꞉test꞉> ']);
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    testUtil.log(suite, 'test.clj closed');
  });

  test('Jack-in afterPrimaryReplConnectedCode can be an array', async () => {
    testUtil.log(suite, 'Jack-in afterPrimaryReplConnectedCode can be an array');
    const connectSequence: ReplConnectSequence = {
      projectType: ProjectTypes['deps.edn'],
      name: 'array-afterPrimaryReplConnectedCode',
      autoSelectForJackIn: true,
      projectRootPath: ['.'],
      afterPrimaryReplConnectedCode: ['(println :hello)', '(println :world!)'].join('\n'),
      cljsType: CljsTypes.none,
    };
    const testFilePath = await startJackInProcedure(
      suite,
      'calva.jackIn',
      'deps.edn',
      'test.clj',
      connectSequence
    );
    await loadAndAssert(suite, testFilePath, [
      '; :hello',
      '; :world!',
      '; bar',
      'nil',
      'clj꞉test꞉> ',
    ]);
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    testUtil.log(suite, 'test.clj closed');
  });

  test('Jack-in still accepts afterCLJReplJackInCode', async () => {
    testUtil.log(suite, 'Jack-in still accepts afterCLJReplJackInCode');
    const connectSequence: ReplConnectSequence = {
      projectType: ProjectTypes['deps.edn'],
      name: 'legacy-afterCLJReplJackInCode',
      autoSelectForJackIn: true,
      projectRootPath: ['.'],
      afterCLJReplJackInCode: '(println :legacy :hook!)',
      cljsType: CljsTypes.none,
    };
    const testFilePath = await startJackInProcedure(
      suite,
      'calva.jackIn',
      'deps.edn',
      'test.clj',
      connectSequence
    );
    await loadAndAssert(suite, testFilePath, ['; :legacy :hook!', '; bar', 'nil', 'clj꞉test꞉> ']);
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    testUtil.log(suite, 'test.clj closed');
  });

  test('Jack-in works with auto-selected project type', async () => {
    testUtil.log(suite, 'Jack-in works with auto-selected project type');

    const connectSequence: ReplConnectSequence = {
      projectType: ProjectTypes['deps.edn'],
      name: 'auto-select',
      autoSelectForJackIn: true,
      projectRootPath: ['.'],
      cljsType: CljsTypes.none,
    };
    const testFilePath = await startJackInProcedure(
      suite,
      'calva.jackIn',
      'deps.edn',
      'test.clj',
      connectSequence
    );
    await loadAndAssert(suite, testFilePath, ['; bar', 'nil', 'clj꞉test꞉> ']);

    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    testUtil.log(suite, 'test.clj closed');
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

async function loadAndAssert(suite: string, testFilePath: string, needle: string[]) {
  const replWindowDoc = await waitForResult(suite);

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

async function waitForResult(suite: string) {
  await waitForNextClient(suite);
  await waitForJackInCompletion(suite);
  await testUtil.sleep(500);
  testUtil.log(suite, 'connected to repl');

  return getDocument(await outputWindow.openReplWindowDoc());
}

async function waitForNextClient(suite: string) {
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
      return;
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
  const testFilePath = path.join(testUtil.testDataDir, testFile);
  await testUtil.openFile(testFilePath);
  testUtil.log(suite, `${testFile} opened for project type ${projectType}`);

  const candidateRoots = await projectRoot.findProjectRoots();
  const projectRootUri =
    projectRoot.findClosestParent(vscode.window.activeTextEditor?.document.uri, candidateRoots) ??
    vscode.workspace.workspaceFolders?.[0]?.uri ??
    vscode.Uri.file(testUtil.testDataDir);

  const connectSequence =
    connectSequenceOverride ?? buildConnectSequence(projectType, projectRootUri);

  if (cmdId === 'calva.jackIn' || cmdId === 'calva.copyJackInCommandToClipboard') {
    await commands.executeCommand(cmdId, { connectSequence, disableAutoSelect: true });
  } else {
    await commands.executeCommand(cmdId);
  }

  return testFilePath;
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
