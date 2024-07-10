import * as assert from 'assert';
import { before, after, beforeEach } from 'mocha';
import * as path from 'path';
import * as testUtil from './util';
import * as state from '../../../state';
import * as util from '../../../utilities';

import * as vscode from 'vscode';
// import * as myExtension from '../extension';
import * as outputWindow from '../../../repl-window/repl-doc';
import { commands } from 'vscode';
import { getDocument } from '../../../doc-mirror';
import * as projectRoot from '../../../project-root';
import { getConfig, updateWorkspaceConfig } from '../../../config';

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

// TODO: Add more smoke tests for the extension
// TODO: Start building integration test coverage

suite('Jack-in suite', () => {
  const suite = 'Jack-in';

  before(async () => {
    testUtil.showMessage(suite, `suite starting!`);
    await vscode.workspace.fs.copy(settingsUri, settingsBackupUri, { overwrite: true });
  });

  after(async () => {
    console.log(suite, 'workspaceRoot', vscode.workspace.workspaceFolders[0].uri.fsPath);
    testUtil.showMessage(suite, `suite done!`);
    await vscode.workspace.fs.delete(settingsBackupUri);
  });

  beforeEach(async () => {
    await vscode.workspace.fs.copy(settingsBackupUri, settingsUri, { overwrite: true });
    await outputWindow.clearResultsDoc();
  });

  test('start repl and connect (jack-in)', async function () {
    testUtil.log(suite, 'start repl and connect (jack-in)');

    const settings = {};
    await writeSettings(settings);

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

      const settings = {};
      await writeSettings(settings);

      const testFilePath = await startJackInProcedure(
        suite,
        'calva.jackIn',
        'basilisp',
        '../projects/minimal-basilisp/src/test.lpy'
      );

      await loadAndAssert(suite, testFilePath, ['; bar', 'nil', 'clj꞉test꞉> ']);

      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
      testUtil.log(suite, 'test.lpy closed for Basilisp');
    }
  });

  test('Jack-in afterCLJReplJackInCode can be a string', async () => {
    testUtil.log(suite, 'Jack-in afterCLJReplJackInCode can be a string');
    const settings = {
      'calva.replConnectSequences': [
        {
          projectType: 'deps.edn',
          name: 'string-afterCLJReplJackInCode',
          autoSelectForJackIn: true,
          projectRootPath: ['.'],
          afterCLJReplJackInCode: '(println :hello :world!)',
        },
      ],
    };
    await writeSettings(settings);
    const testFilePath = await startJackInProcedure(suite, 'calva.jackIn', 'deps.edn', 'test.clj');
    await loadAndAssert(suite, testFilePath, ['; :hello :world!', '; bar', 'nil', 'clj꞉test꞉> ']);
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    testUtil.log(suite, 'test.clj closed');
  });

  test('Jack-in afterCLJReplJackInCode can be an array', async () => {
    testUtil.log(suite, 'Jack-in afterCLJReplJackInCode can be an array');
    const settings = {
      'calva.replConnectSequences': [
        {
          projectType: 'deps.edn',
          name: 'array-afterCLJReplJackInCode',
          autoSelectForJackIn: true,
          projectRootPath: ['.'],
          afterCLJReplJackInCode: ['(println :hello)', '(println :world!)'],
        },
      ],
    };
    await writeSettings(settings);
    const testFilePath = await startJackInProcedure(suite, 'calva.jackIn', 'deps.edn', 'test.clj');
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

  test('Jack-in works with auto-selected project type', async () => {
    testUtil.log(suite, 'Jack-in works with auto-selected project type');

    const settings = {
      'calva.replConnectSequences': [
        {
          projectType: 'deps.edn',
          name: 'auto-select',
          autoSelectForJackIn: true,
          projectRootPath: ['.'],
        },
      ],
    };
    await writeSettings(settings);
    const testFilePath = await startJackInProcedure(
      suite,
      'calva.jackIn',
      undefined,
      'test.clj',
      true
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

async function loadAndAssert(suite: string, testFilePath: string, needle: string[]) {
  const resultsDoc = await waitForResult(suite);

  // focus the clojure file
  await vscode.workspace.openTextDocument(testFilePath).then((doc) =>
    vscode.window.showTextDocument(doc, {
      preserveFocus: false,
    })
  );
  testUtil.log(suite, 'opened test.clj document again');

  await commands.executeCommand('calva.loadFile');
  const haystack = resultsDoc.document.getText().split(/\r?\n/);
  assert.ok(
    appearInOrder(needle, haystack),
    `Expected output to contain: ${JSON.stringify(needle)}\n, but got: ${JSON.stringify(
      haystack
    )}\n`
  );
}

function writeSettings(settings: any): Thenable<void> {
  const settingsData = JSON.stringify(settings, null, 2);
  const p = vscode.workspace.fs.writeFile(settingsUri, Buffer.from(settingsData));
  console.log(`Settings written to ${settingsUri.fsPath}`);
  return p;
}

async function waitForResult(suite: string) {
  while (!util.getConnectedState()) {
    testUtil.log(suite, 'waiting for connect...');
    await testUtil.sleep(1000);
  }
  await testUtil.sleep(500); // wait a little longer for repl output to be done
  testUtil.log(suite, 'connected to repl');

  return getDocument(await outputWindow.openResultsDoc());
}

async function startJackInProcedure(
  suite: string,
  cmdId: string,
  projectType: string,
  testFile: string,
  autoSelectProjectRoot = false
) {
  const testFilePath = path.join(testUtil.testDataDir, testFile);
  await testUtil.openFile(testFilePath);
  testUtil.log(suite, `${testFile} opened for project type ${projectType}`);

  const projectRootUri = projectRoot.findClosestParent(
    vscode.window.activeTextEditor?.document.uri,
    await projectRoot.findProjectRoots()
  );
  // Project type pre-select, qps = quickPickSingle
  const saveAs = `qps-${projectRootUri.toString()}/jack-in-type`;
  await state.extensionContext.workspaceState.update(saveAs, { label: projectType });

  let resolved = false;
  void commands.executeCommand(cmdId).then(() => {
    resolved = true;
  });

  while (!resolved) {
    if (!autoSelectProjectRoot) {
      // Project root quick pick
      await commands.executeCommand('workbench.action.acceptSelectedQuickOpenItem');
    }
    await testUtil.sleep(100);
  }

  return testFilePath;
}
