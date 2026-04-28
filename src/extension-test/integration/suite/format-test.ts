import * as assert from 'assert';
import * as mocha from 'mocha';
import * as path from 'path';
import * as testUtil from './util';
import * as vscode from 'vscode';
import * as textNotation from '../integration-text-notation';

const suiteName = 'Format suite';

// Test data: a short .clj:
const testFilePath = path.join(testUtil.testDataDir, 'reformattable.clj');

/** Document text
 * @param replaceNewLine Whether to represent newlines by a dot
 */
function getText(doc: vscode.TextDocument, replaceNewLine = false): string {
  const text = doc.getText(
    doc.validateRange(
      new vscode.Range(new vscode.Position(0, 0), new vscode.Position(99999, 99999))
    )
  );
  return replaceNewLine ? text.split(doc.eol == 1 ? '\n' : '\r\n').join('•') : text;
}

/** Text+selections string indicating cursors by |, |1, |2, etc.
 * @param ranges Array of selections' [anchor,active]
 * @param prettyPrint False to represent newline by a dot, true for a newline
 */
function textNotationFromDocAndSelections(
  doc: vscode.TextDocument,
  selections: readonly vscode.Selection[],
  prettyPrint = false
): string {
  const ranges: [number, number][] = selections.map((s) => [
    doc.offsetAt(s.start),
    doc.offsetAt(s.end),
  ]);
  const text = getText(doc, true);
  return textNotation.textNotationFromTextAndSelections(text, ranges, prettyPrint);
}

/** Cursor positions indicated in textAndSelections by |, |1, |2, etc. */
async function reformat(editor: vscode.TextEditor, textAndSelections: string, command: string) {
  const [text, selectionsAsOffsets] =
    textNotation.textNotationToTextAndSelection(textAndSelections);
  await vscode.commands.executeCommand('editor.action.selectAll');
  await vscode.commands.executeCommand(
    'paredit.deleteForward' /*'editor.action.clipboardCutAction'*/
  );
  await testUtil.waitForCondition(
    () => getText(editor.document) === '',
    2000,
    20,
    'Timed out waiting for document to clear before reformat'
  );
  const emptiedText = getText(editor.document);
  if (emptiedText !== '') {
    console.error('Supposedly emptied document contains', emptiedText);
  }
  await editor.edit((ed) => {
    ed.insert(new vscode.Position(0, 0), text);
  });
  editor.selections = selectionsAsOffsets.map(
    ([anchorOffset, activeOffset]) =>
      new vscode.Selection(
        editor.document.positionAt(anchorOffset),
        editor.document.positionAt(activeOffset)
      )
  );
  await testUtil.waitForCondition(
    () =>
      textNotationFromDocAndSelections(editor.document, editor.selections) === textAndSelections,
    2000,
    20,
    `Timed out waiting for editor reset to ${JSON.stringify(textAndSelections)}`
  );
  await vscode.commands.executeCommand(command);
  const result = await testUtil.waitForStableValue(
    () => {
      const notation = textNotationFromDocAndSelections(editor.document, editor.selections);
      return notation !== textAndSelections ? notation : undefined;
    },
    100,
    4000,
    20,
    `Timed out waiting for reformat command ${command} to change editor state`
  );
  console.log(
    `reformat: command=${command}, intermediateStates=${result.intermediateCount}, stableAfter=${result.stableAfterMs}ms`
  );
  if (result.intermediateCount > 0) {
    console.log(`reformat: WARNING intermediate states detected before settling`);
  }
  return result.value;
}

/** Cursor positions indicated in textAndSelections by |, |1, |2, etc. */
async function reformatUsingActiveEditor(textAndSelections: string) {
  return reformat(vscode.window.activeTextEditor, textAndSelections, 'calva-fmt.formatCurrentForm');
}

suite(suiteName, () => {
  mocha.before(async () => {
    testUtil.showMessage(suiteName, `suite starting`);
    await testUtil.openFile(testFilePath);
  });

  mocha.after(async () => {
    console.log('Finally, format suite is closing the active editor');
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    testUtil.showMessage(suiteName, `suite done!`);
  });

  mocha.it('should add indenting spaces on lines where cursors are', async () => {
    assert.equal(await reformatUsingActiveEditor('(foo•|•|1 :a)'), '(foo•  |•|1  :a)');
  });

  mocha.it('should advance indented cursors to proper indentation spot', async () => {
    assert.equal(await reformatUsingActiveEditor('(foo•|• |1:a)'), '(foo•  |•  |1:a)');
  });

  mocha.it('should remove spaces and commas from an empty list', async () => {
    assert.equal(await reformatUsingActiveEditor('(•|•,)'), '(|)');
  });

  mocha.it('should format deftype', async () => {
    assert.equal(
      await reformatUsingActiveEditor(
        '(deftype MyType [arg1 arg2]•  IMyProto•  (method1 [this]•           |(smth)))'
      ),
      '(deftype MyType [arg1 arg2]•  IMyProto•  (method1 [this]•    |(smth)))'
    );
  });

  mocha.it('should not remove a single blank line', async () => {
    assert.equal(
      await reformatUsingActiveEditor('(defn bar• |   [x]••    baz)'),
      '(defn bar• | [x]••  baz)'
    );
  });

  mocha.it('should collapse consecutive blank lines to a single line', async () => {
    assert.equal(
      await reformatUsingActiveEditor('(defn bar• |   [x]• •,••    baz)'),
      '(defn bar• | [x]••  baz)'
    );
  });

  mocha.it('should close a rich comment form on a new line (1)', async () => {
    assert.equal(
      await reformatUsingActiveEditor('(comment•  (def foo•:foo)|)'),
      '(comment•  (def foo•    :foo)•  |)'
    );
  });

  mocha.it('should close a rich comment form on a new line (2)', async () => {
    assert.equal(
      await reformatUsingActiveEditor('(comment•  |(def foo•:foo))'),
      '(comment•  |(def foo•    :foo)•  )'
    );
  });

  mocha.it('should automatically reformat all paredited forms', async () => {
    assert.equal(
      await reformat(
        vscode.window.activeTextEditor,
        '(defn foo [x|]•42)••(defn bar [y]•62)••(defn baz [z|1]•82)',
        'paredit.slurpSexpForward'
      ),
      '(defn foo [x|•           42])••(defn bar [y]•62)••(defn baz [z|1•           82])'
    );
  });

  mocha.it('should format a ns form alone', async () => {
    assert.equal(await reformatUsingActiveEditor('(ns •       |foo)'), '(ns• |foo)');
  });
});
