import assert from 'assert';
import { before, after } from 'mocha';
import path from 'path';
import testUtil from './util';

import vscode from 'vscode';
import highlight from '../../../highlight/src/extension';

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

    assert.strictEqual(highlight.activeEditor, undefined);

    const testFilePath = path.join(testUtil.testDataDir, 'test.clj');
    await testUtil.openFile(testFilePath);
    testUtil.log(suite, 'test.clj opened');

    assert.notStrictEqual(highlight.activeEditor, undefined);

    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    testUtil.log(suite, 'test.clj closed');
  });
});
