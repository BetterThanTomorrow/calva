import * as assert from 'assert';
import { before, after } from 'mocha';
import * as path from 'path';
import * as testUtil from './util';

import * as vscode from 'vscode';
import * as highlight from '../../../highlight/src/extension';

async function waitForCondition(predicate: () => boolean, timeoutMs = 4000, intervalMs = 50) {
  const start = Date.now();
  while (true) {
    if (predicate()) {
      return;
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await testUtil.sleep(intervalMs);
  }
}

suite('Highlight suite', () => {
  const suite = 'Highlight';

  before(() => {
    testUtil.showMessage(suite, `suite starting!`);
  });

  after(() => {
    testUtil.showMessage(suite, `suite done!`);
  });

  test('activeEditor', async function () {
    testUtil.log(suite, 'activeEditor');

    const initialEditor = highlight.activeEditor;
    const testFilePath = path.join(testUtil.testDataDir, 'test.clj');

    await testUtil.openFile(testFilePath);
    testUtil.log(suite, 'test.clj opened');

    await waitForCondition(() => highlight.activeEditor?.document.uri.fsPath === testFilePath);
    assert.strictEqual(highlight.activeEditor?.document.uri.fsPath, testFilePath);

    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    testUtil.log(suite, 'test.clj closed');

    await waitForCondition(() => highlight.activeEditor?.document.uri.fsPath !== testFilePath);
  });
});
