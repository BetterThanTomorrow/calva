import * as assert from 'assert';
import { before, after, it } from 'mocha';
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

const pauseMs = 250;

/** Cursor positions indicated in textAndSelections by |, |1, |2, etc. */
async function reformat(editor: vscode.TextEditor, textAndSelections: string, command: string) {
  const [text, selectionsAsOffsets] =
    textNotation.textNotationToTextAndSelection(textAndSelections);
  await vscode.commands.executeCommand('editor.action.selectAll');
  await new Promise((resolve) => setTimeout(resolve, pauseMs));
  await vscode.commands.executeCommand(
    'paredit.deleteForward' /*'editor.action.clipboardCutAction'*/
  );
  await new Promise((resolve) => setTimeout(resolve, pauseMs));
  const emptiedText = getText(editor.document);
  if (emptiedText != '') {
    console.error('Supposedly emptied document contains', emptiedText);
  }
  await editor.edit((ed) => {
    ed.insert(new vscode.Position(0, 0), text);
  });
  await new Promise((resolve) => setTimeout(resolve, pauseMs));
  editor.selections = selectionsAsOffsets.map(
    ([anchorOffset, activeOffset]) =>
      new vscode.Selection(
        editor.document.positionAt(anchorOffset),
        editor.document.positionAt(activeOffset)
      )
  );
  await new Promise((resolve) => setTimeout(resolve, pauseMs));
  await vscode.commands.executeCommand(command);
  await new Promise((resolve) => setTimeout(resolve, pauseMs));
  return textNotationFromDocAndSelections(editor.document, editor.selections);
}

/** Cursor positions indicated in textAndSelections by |, |1, |2, etc. */
async function reformatUsingActiveEditor(textAndSelections: string) {
  return reformat(vscode.window.activeTextEditor, textAndSelections, 'calva-fmt.formatCurrentForm');
}

suite(suiteName, () => {
  before(async () => {
    testUtil.showMessage(suiteName, `suite starting`);
    return testUtil.openFile(testFilePath).then((x) => {
      return new Promise((resolve) => setTimeout(resolve, 1000));
    });
  });

  after(async () => {
    console.log('Finally, format suite is closing the active editor');
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    testUtil.showMessage(suiteName, `suite done!`);
  });

  it('should add indenting spaces on lines where cursors are', async () => {
    await new Promise((resolve) => setTimeout(resolve, 20 * pauseMs));
    assert.equal(await reformatUsingActiveEditor('(foo•|•|1 :a)'), '(foo•  |•|1  :a)');
  });

  it('should advance indented cursors to proper indentation spot', async () => {
    assert.equal(await reformatUsingActiveEditor('(foo•|• |1:a)'), '(foo•  |•  |1:a)');
  });

  it('should remove spaces and commas from an empty list', async () => {
    assert.equal(await reformatUsingActiveEditor('(•|•,)'), '(|)');
  });

  it('should format deftype', async () => {
    assert.equal(
      await reformatUsingActiveEditor(
        '(deftype MyType [arg1 arg2]•  IMyProto•  (method1 [this]•           |(smth)))'
      ),
      '(deftype MyType [arg1 arg2]•  IMyProto•  (method1 [this]•    |(smth)))'
    );
  });

  it('should not remove a single blank line', async () => {
    assert.equal(
      await reformatUsingActiveEditor('(defn bar• |   [x]••    baz)'),
      '(defn bar• | [x]••  baz)'
    );
  });

  it('should collapse consecutive blank lines to a single line', async () => {
    assert.equal(
      await reformatUsingActiveEditor('(defn bar• |   [x]• •,••    baz)'),
      '(defn bar• | [x]••  baz)'
    );
  });

  it('should close a rich comment form on a new line (1)', async () => {
    assert.equal(
      await reformatUsingActiveEditor('(comment•  (def foo•:foo)|)'),
      '(comment•  (def foo•    :foo)•  |)'
    );
  });

  it('should close a rich comment form on a new line (2)', async () => {
    assert.equal(
      await reformatUsingActiveEditor('(comment•  |(def foo•:foo))'),
      '(comment•  |(def foo•    :foo)•  )'
    );
  });

  it('should automatically reformat all paredited forms', async () => {
    assert.equal(
      await reformat(
        vscode.window.activeTextEditor,
        '(defn foo [x|]•42)••(defn bar [y]•62)••(defn baz [z|1]•82)',
        'paredit.slurpSexpForward'
      ),
      '(defn foo [x|•           42])••(defn bar [y]•62)••(defn baz [z|1•           82])'
    );
  });

  it('should format a ns form alone', async () => {
    assert.equal(await reformatUsingActiveEditor('(ns •       |foo)'), '(ns• |foo)');
  });
});
