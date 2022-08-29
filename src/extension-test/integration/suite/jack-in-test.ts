import * as assert from 'assert';
import { before, after } from 'mocha';
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

// TODO: Add more smoke tests for the extension
// TODO: Start building integration test coverage

suite('Jack-in suite', () => {
  const suite = 'Jack-in';

  before(() => {
    testUtil.showMessage(suite, `suite starting!`);
  });

  after(() => {
    testUtil.showMessage(suite, `suite done!`);
  });

  test('start repl and connect (jack-in)', async function () {
    testUtil.log(suite, 'start repl and connect (jack-in)');

    const testFilePath = await startJackInProcedure(suite, 'calva.jackIn', 'deps.edn');

    while (!util.getConnectedState()) {
      testUtil.log(suite, 'waiting for connect...');
      await testUtil.sleep(200);
    }
    await testUtil.sleep(500); // wait a little longer for repl output to be done
    testUtil.log(suite, 'connected to repl');

    const resultsDoc = getDocument(await outputWindow.openResultsDoc());

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
      ['; Evaluating file: test.clj', 'bar', 'nil', 'clj꞉test꞉> ', ''].reverse(),
      reversedLines.slice(0, 5).map((v) => v.text)
    );

    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    testUtil.log(suite, 'test.clj closed');
  });

  test('Copy Jack-in command line', async function () {
    console.log('Copy Jack-in command line');

    await startJackInProcedure(suite, 'calva.copyJackInCommandToClipboard', 'deps.edn');

    const cmdLine = await vscode.env.clipboard.readText();

    assert.ok(cmdLine.includes('deps.clj.jar'));

    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    testUtil.log(suite, 'test.clj closed');
  });
});

async function startJackInProcedure(suite: string, cmdId: string, projectType: string) {
  const testFilePath = path.join(testUtil.testDataDir, 'test.clj');
  await testUtil.openFile(testFilePath);
  testUtil.log(suite, 'test.clj opened');

  const projectRootPath = await projectRoot.findClosestProjectRootPath();
  const projetcRootUri = vscode.Uri.file(projectRootPath);
  // Project type pre-select, qps = quickPickSingle
  const saveAs = `qps-${projetcRootUri.toString()}/jack-in-type`;
  await state.extensionContext.workspaceState.update(saveAs, projectType);

  const res = commands.executeCommand(cmdId);

  // Project root quick pick
  while (util.quickPickActive === undefined) {
    await testUtil.sleep(50);
  }
  await util.quickPickActive;
  await commands.executeCommand('workbench.action.acceptSelectedQuickOpenItem');

  // Project type quickpick
  // pre-select deps.edn as the repl connect sequence
  while (util.quickPickActive === undefined) {
    await testUtil.sleep(50);
  }
  await util.quickPickActive;
  await commands.executeCommand('workbench.action.acceptSelectedQuickOpenItem');

  await res;
  return testFilePath;
}
