import * as assert from 'assert';
import { expect } from 'chai';
import { after } from 'mocha';
import * as path from 'path';
import * as testUtil from './util';
import * as state from '../../../state';
import * as util from '../../../utilities';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../extension';
import * as outputWindow from '../../../results-output/results-doc';
import { commands } from 'vscode';
import { getDocument } from '../../../doc-mirror';
import * as projectRoot from '../../../project-root';

void vscode.window.showInformationMessage('Tests running. Yay!');

suite('Extension Test Suite', () => {
  after(() => {
    void vscode.window.showInformationMessage('All tests done!');
  });

  // test("We have a context", async () => {
  //   const context = calvaState.extensionContext; // Makes things croak with message "state.config is not a function"
  //   expect(context).not.undefined("foo");
  //   context.workspaceState.get('selectedCljTypeName')
  // });

  test('Sample test', async () => {
    await sleep(1000);
    assert.equal(-1, [1, 2, 3].indexOf(5));
    assert.equal(-1, [1, 2, 3].indexOf(0));
  });

  // test("open a file and close it again, w/o croaking", async () => {
  //   expect(vscode.window.activeTextEditor).undefined;
  //   const testClj = await openFile(path.join(util.testDataDir, 'test.clj'));
  //   vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  //   await sleep(1000);
  //   expect(vscode.window.activeTextEditor).undefined;
  // });

  test('start repl and connect (jack-in)', async function () {
    console.log('start repl and connect (jack-in)');
    const testFilePath = path.join(testUtil.testDataDir, 'test.clj');
    await openFile(testFilePath);
    console.log('file opened');

    const projectRootPath = await projectRoot.findClosestProjectRootPath();
    const projetcRootUri = vscode.Uri.file(projectRootPath);
    // Project type pre-select, qps = quickPickSingle
    const saveAs = `qps-${projetcRootUri.toString()}/jack-in-type`;
    await state.extensionContext.workspaceState.update(saveAs, 'deps.edn');

    const res = commands.executeCommand('calva.jackIn');

    // Project root quick pick
    while (util.quickPickActive === undefined) {
      await sleep(50);
    }
    await util.quickPickActive;
    await commands.executeCommand('workbench.action.acceptSelectedQuickOpenItem');

    // Project type quickpick
    // pre-select deps.edn as the repl connect sequence
    while (util.quickPickActive === undefined) {
      await sleep(50);
    }
    await util.quickPickActive;
    await commands.executeCommand('workbench.action.acceptSelectedQuickOpenItem');

    await res;
    console.log('waiting for connect');
    while (!util.getConnectedState()) {
      console.log('waiting for connect...');
      await sleep(200);
    }
    await sleep(500); // wait a little longer for repl output to be done
    console.log('connected to repl');

    const resultsDoc = getDocument(await outputWindow.openResultsDoc());

    // focus the clojure file
    await vscode.workspace.openTextDocument(testFilePath).then((doc) =>
      vscode.window.showTextDocument(doc, {
        preserveFocus: false,
      })
    );
    console.log('opened document again');

    await commands.executeCommand('calva.loadFile');
    const reversedLines = resultsDoc.model.lineInputModel.lines.reverse();
    assert.deepEqual(
      ['', 'clj꞉test꞉> ', 'nil', 'bar', '; Evaluating file: test.clj'],
      reversedLines.slice(0, 5).map((v) => v.text)
    );
  });

  // TODO: Add more smoke tests for the extension
  // TODO: Start building integration test coverage
});

async function openFile(filePath: string) {
  const uri = vscode.Uri.file(filePath);
  const document = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(document);

  await sleep(300);

  return editor;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
