import * as assert from 'assert';
import { before, after, beforeEach } from 'mocha';
import * as path from 'path';
import * as testUtil from './util';
import * as state from '../../../state';
import * as util from '../../../utilities';

import * as vscode from 'vscode';
// import * as myExtension from '../extension';
import * as outputWindow from '../../../results-output/results-doc';
import { commands } from 'vscode';
import { getDocument } from '../../../doc-mirror';
import * as projectRoot from '../../../project-root';
import { updateWorkspaceConfig } from '../../../config';

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
  });

  test('start repl and connect (jack-in)', async function () {
    testUtil.log(suite, 'start repl and connect (jack-in)');

    const testFilePath = await startJackInProcedure(suite, 'calva.jackIn', 'deps.edn');

    await loadAndAssert(suite, testFilePath);

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
    const testFilePath = await startJackInProcedure(suite, 'calva.jackIn', undefined, true);
    await loadAndAssert(suite, testFilePath);

    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    testUtil.log(suite, 'test.clj closed');
  });

  test('Copy Jack-in command line', async function () {
    testUtil.log('Copy Jack-in command line');

    await startJackInProcedure(suite, 'calva.copyJackInCommandToClipboard', 'deps.edn');

    const cmdLine = await vscode.env.clipboard.readText();
    testUtil.log(suite, 'cmdLine', cmdLine);

    assert.ok(cmdLine.includes('clojure'));

    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    testUtil.log(suite, 'test.clj closed');
  });
});

async function loadAndAssert(suite: string, testFilePath: string) {
  const resultsDoc = await waitForResult(suite);

  // focus the clojure file
  await vscode.workspace.openTextDocument(testFilePath).then((doc) =>
    vscode.window.showTextDocument(doc, {
      preserveFocus: false,
    })
  );
  testUtil.log(suite, 'opened document again');

  await commands.executeCommand('calva.loadFile');
  const reversedLines = resultsDoc.model.lineInputModel.lines.reverse();
  assert.deepEqual(
    ['bar', 'nil', 'clj꞉test꞉> '].reverse(),
    reversedLines.slice(1, 4).map((v) => v.text)
  );
}

async function writeSettings(settings: any): Promise<void> {
  const settingsData = JSON.stringify(settings, null, 2);
  await vscode.workspace.fs.writeFile(settingsUri, Buffer.from(settingsData));
  console.log(`Settings written to ${settingsUri.fsPath}`);
}

async function waitForResult(suite: string) {
  while (!util.getConnectedState()) {
    testUtil.log(suite, 'waiting for connect...');
    await testUtil.sleep(200);
  }
  await testUtil.sleep(500); // wait a little longer for repl output to be done
  testUtil.log(suite, 'connected to repl');

  return getDocument(await outputWindow.openResultsDoc());
}

async function startJackInProcedure(
  suite: string,
  cmdId: string,
  projectType: string,
  autoSelectProjectRoot = false
) {
  const testFilePath = path.join(testUtil.testDataDir, 'test.clj');
  await testUtil.openFile(testFilePath);
  testUtil.log(suite, 'test.clj opened');

  const projectRootUri = projectRoot.findClosestParent(
    vscode.window.activeTextEditor?.document.uri,
    await projectRoot.findProjectRoots()
  );
  // Project type pre-select, qps = quickPickSingle
  const saveAs = `qps-${projectRootUri.toString()}/jack-in-type`;
  await state.extensionContext.workspaceState.update(saveAs, projectType);

  let resolved = false;
  void commands.executeCommand(cmdId).then(() => {
    resolved = true;
  });

  while (!resolved) {
    if (!autoSelectProjectRoot) {
      // Project root quick pick
      await commands.executeCommand('workbench.action.acceptSelectedQuickOpenItem');
    }
    await testUtil.sleep(50);
  }

  return testFilePath;
}
