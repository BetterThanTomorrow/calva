import * as assert from 'assert';
import { before, after, it } from 'mocha';
import * as path from 'path';
import * as testUtil from './util';
import * as vscode from 'vscode';
import * as textNotation from '../integration-text-notation';

const suiteName = 'Toggle Comment Suite';

// Reuse existing test data file
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

/** Toggle line comment with cursor positions indicated by |, |1, |2, etc. */
async function toggleComment(editor: vscode.TextEditor, textAndSelections: string) {
  const [text, selectionsAsOffsets] =
    textNotation.textNotationToTextAndSelection(textAndSelections);
  await vscode.commands.executeCommand('editor.action.selectAll');
  await new Promise((resolve) => setTimeout(resolve, pauseMs));
  await vscode.commands.executeCommand('paredit.deleteForward');
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
  await vscode.commands.executeCommand('calva.toggleLineComment');
  await new Promise((resolve) => setTimeout(resolve, pauseMs));
  return textNotationFromDocAndSelections(editor.document, editor.selections);
}

/** Toggle line comment using active editor */
async function toggleCommentUsingActiveEditor(textAndSelections: string) {
  return toggleComment(vscode.window.activeTextEditor, textAndSelections);
}

suite(suiteName, () => {
  before(async () => {
    testUtil.showMessage(suiteName, `suite starting`);
    return testUtil.openFile(testFilePath).then((x) => {
      return new Promise((resolve) => setTimeout(resolve, 1000));
    });
  });

  after(async () => {
    console.log('Finally, toggle comment suite is closing the active editor');
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    testUtil.showMessage(suiteName, `suite done!`);
  });

  it('should comment a code line inside defn with correct indent', async () => {
    await new Promise((resolve) => setTimeout(resolve, 20 * pauseMs));
    assert.equal(
      await toggleCommentUsingActiveEditor('(defn foo []•  |(println "test"))'),
      '(defn foo []•  |;; (println "test"))'
    );
  });

  it('should uncomment a line and restore correct indentation', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor('(defn foo []•  |;; (println "test"))'),
      '(defn foo []•  |(println "test"))'
    );
  });

  it('should comment an empty line inside assoc with alignment indent (issue #2872)', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor('(assoc m•       :key :val•|)'),
      '(assoc m•       :key :val•       |;;)'
    );
  });

  it('should comment a line in aligned position with correct indent', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor('(assoc m•       :key :val•       |(+ 1 2))'),
      '(assoc m•       :key :val•       |;; (+ 1 2))'
    );
  });

  it('should uncomment an aligned line and restore alignment', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor('(assoc m•       :key :val•       |;; (+ 1 2))'),
      '(assoc m•       :key :val•       |(+ 1 2))'
    );
  });

  it('should handle multiple cursors on different lines', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor('(defn foo []•  |(println "a")•  |1(println "b"))'),
      '(defn foo []•  |;; (println "a")•  |1;; (println "b"))'
    );
  });

  it('should uncomment multiple lines with correct indentation', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor(
        '(defn foo []•  |;; (println "a")•  |1;; (println "b"))'
      ),
      '(defn foo []•  |(println "a")•  |1(println "b"))'
    );
  });

  it('should comment at top level with zero indent', async () => {
    assert.equal(await toggleCommentUsingActiveEditor('|(defn foo [])'), '|;; (defn foo [])');
  });

  it('should comment inside let binding vector with alignment', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor('(let [x 1•      |y 2]•  x)'),
      '(let [x 1•      |;; y 2]•  x)'
    );
  });

  it('should handle nested forms with correct indent', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor('(defn foo []•  (when true•    |(+ 1 2)))'),
      '(defn foo []•  (when true•    |;; (+ 1 2)))'
    );
  });
});
