import assert from 'assert';
import { before, after } from 'mocha';
import path from 'path';
import testUtil from './util';
import state from '../../../state';
import util from '../../../utilities';

import vscode from 'vscode';
// import myExtension from '../extension';
import outputWindow from '../../../results-output/results-doc';
import { commands } from 'vscode';
import { getDocument } from '../../../doc-mirror';
import projectRoot from '../../../project-root';

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
      ['bar', 'nil', 'clj꞉test꞉> ', ''].reverse(),
      reversedLines.slice(0, 4).map((v) => v.text)
    );

    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    testUtil.log(suite, 'test.clj closed');
  });

  test('Copy Jack-in command line', async function () {
    console.log('Copy Jack-in command line');

    await startJackInProcedure(suite, 'calva.copyJackInCommandToClipboard', 'deps.edn');

    const cmdLine = await vscode.env.clipboard.readText();

    assert.ok(cmdLine.startsWith('clojure'));

    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    testUtil.log(suite, 'test.clj closed');
  });
});

async function startJackInProcedure(suite: string, cmdId: string, projectType: string) {
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

  // Project root quick pick
  while (!resolved) {
    await commands.executeCommand('workbench.action.acceptSelectedQuickOpenItem');
    await testUtil.sleep(50);
  }

  return testFilePath;
}
