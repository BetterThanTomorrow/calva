import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';

import { before, after, afterEach } from 'mocha';
import * as sinon from 'sinon';

import annotations from '../../../providers/annotations';
import * as testUtil from './util';

suite('Annotations suite', () => {
  const suite = 'Annotations';

  before(() => {
    testUtil.showMessage(suite, `suite starting!`);
  });

  after(() => {
    testUtil.showMessage(suite, `suite done!`);
  });

  afterEach(function () {
    sinon.restore(); // Restore original methods
  });

  test('decorate result trims leading whitespaces', async function () {
    // any file would do
    const testFilePath = path.join(testUtil.testDataDir, 'test.clj');
    const editor = await testUtil.openFile(testFilePath);

    // Any range will do, the range below happens to be around "(foo)".
    const range = new vscode.Range(new vscode.Position(11, 0), new vscode.Position(11, 5));

    const proxyEditor = testUtil.createVscTextEditorProxy(editor);

    // will eventually call on the editor's `setDecorations` fn with the text to render.
    const setDecorationsSpy = sinon.spy(proxyEditor, 'setDecorations');

    // an error with
    annotations.decorateResults(
      ' \nLine2 exception message\nLine3 error',
      true,
      range,
      proxyEditor
    );
    const args = setDecorationsSpy.firstCall.args as [
      decorationType: vscode.TextEditorDecorationType,
      rangesOrOptions: readonly vscode.DecorationOptions[]
    ];

    await testUtil.captureScreenshot(suite, 'decorateResults-empty-1st-line', 1000);

    // The expectation is that all whitespace is removed at the front.
    //
    // Only Line2 should be displayed in the screenshot above, even though Line3 is still in the text.
    assert.strictEqual(
      args[1][0].renderOptions.after.contentText,
      '\u00A0=>\u00A0Line2\u00A0exception\u00A0message\nLine3\u00A0error\u00A0'
    );

    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    testUtil.log(suite, 'test.clj closed');
  });

  test('tooltip contents of evaluated result', async function () {
    // any file would do
    const testFilePath = path.join(testUtil.testDataDir, 'test.clj');
    const editor = await testUtil.openFile(testFilePath);

    // Any range will do, the range below happens to be around "hover-map".
    const selection = new vscode.Selection(2, 5, 2, 14);
    editor.selection = selection;
    const proxyEditor = testUtil.createVscTextEditorProxy(editor);

    // will eventually call on the editor's `setDecorations` fn with the text to render.
    const setDecorationsSpy = sinon.spy(proxyEditor, 'setDecorations');

    const resultString = ' :Line1 with a leading space\n:Line2 some text\n\nLine4 the end.';

    // SUCCESS case, format should contain the result in a clojure code block
    {
      annotations.decorateSelection(
        resultString,
        selection,
        proxyEditor,
        null,
        annotations.AnnotationStatus.SUCCESS
      );

      //await testUtil.sleep(60000);

      assert.deepStrictEqual(
        setDecorationsSpy.firstCall.args[0],
        annotations._getEvalSelectionDecorationTypes(annotations.AnnotationStatus.SUCCESS)
      );
      assert.deepStrictEqual(setDecorationsSpy.firstCall.args[1], []);
      assert.deepStrictEqual(
        setDecorationsSpy.secondCall.args[0],
        annotations._getEvalSelectionDecorationTypes(annotations.AnnotationStatus.SUCCESS)
      );
      const decorateOpts = setDecorationsSpy.secondCall.args[1] as vscode.DecorationOptions[];
      const hoverMessage = decorateOpts[0].hoverMessage as vscode.MarkdownString;
      const expectedResultSuccess = `${annotations._getDecorateSelectionHeader(
        resultString
      )}\n\`\`\`clojure\n${resultString}\n\`\`\``;
      assert.strictEqual(hoverMessage.value, expectedResultSuccess);
    }

    sinon.reset();

    // ERROR case, should contain the result in a plain code block (```)
    {
      annotations.decorateSelection(
        resultString,
        selection,
        proxyEditor,
        null,
        annotations.AnnotationStatus.ERROR
      );

      assert.deepStrictEqual(
        setDecorationsSpy.firstCall.args[0],
        annotations._getEvalSelectionDecorationTypes(annotations.AnnotationStatus.ERROR)
      );
      assert.deepStrictEqual(setDecorationsSpy.firstCall.args[1], []);
      const decorateOpts = setDecorationsSpy.secondCall.args[1] as vscode.DecorationOptions[];
      const hoverMessage = decorateOpts[0].hoverMessage as vscode.MarkdownString;
      const expectedResultSuccess = `${annotations._getDecorateSelectionHeader(
        resultString
      )}\n\`\`\`\n${resultString}\n\`\`\``;
      assert.strictEqual(hoverMessage.value, expectedResultSuccess);
    }

    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });
});
