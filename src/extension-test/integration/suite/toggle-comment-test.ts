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

function getFullDocumentRange(editor: vscode.TextEditor) {
  return editor.document.validateRange(
    new vscode.Range(new vscode.Position(0, 0), new vscode.Position(99999, 99999))
  );
}

function createSelectionFromOffsets(
  editor: vscode.TextEditor,
  [anchorOffset, activeOffset]: [number, number]
) {
  return new vscode.Selection(
    editor.document.positionAt(anchorOffset),
    editor.document.positionAt(activeOffset)
  );
}

async function clearEditor(editor: vscode.TextEditor) {
  await editor.edit((ed) => {
    ed.replace(getFullDocumentRange(editor), '');
  });
  await new Promise((resolve) => setTimeout(resolve, pauseMs));
  const emptiedText = getText(editor.document);
  if (emptiedText !== '') {
    console.error('Supposedly emptied document contains', emptiedText);
  }
}

async function insertText(editor: vscode.TextEditor, text: string) {
  await editor.edit((ed) => {
    ed.insert(new vscode.Position(0, 0), text);
  });
  await new Promise((resolve) => setTimeout(resolve, pauseMs));
}

async function prepareEditorForToggle(editor: vscode.TextEditor, textAndSelections: string) {
  const [text, selections] = textNotation.textNotationToTextAndSelection(textAndSelections);
  await clearEditor(editor);
  await insertText(editor, text);
  editor.selections = selections.map((range) => createSelectionFromOffsets(editor, range));
  await new Promise((resolve) => setTimeout(resolve, pauseMs));
}

async function performToggle(editor: vscode.TextEditor, textAndSelections: string) {
  await prepareEditorForToggle(editor, textAndSelections);
  await vscode.commands.executeCommand('calva.toggleLineComment');
  await new Promise((resolve) => setTimeout(resolve, pauseMs));
}

/** Toggle line comment with cursor positions indicated by |, |1, |2, etc. */
async function toggleComment(editor: vscode.TextEditor, textAndSelections: string) {
  await performToggle(editor, textAndSelections);
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
      '(defn foo []•  ;; |(println "test")•  )'
    );
  });

  it('should uncomment a line and restore correct indentation', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor('(defn foo []•  ;; |(println "test"))'),
      '(defn foo []•  |(println "test"))'
    );
  });

  it('should uncomment a line with single semicolon prefix', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor('(defn foo []•  ; |(println "test"))'),
      '(defn foo []•  |(println "test"))'
    );
  });

  it('should uncomment a line with triple semicolon prefix', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor('(defn foo []•  ;;; |header)'),
      '(defn foo []•  |header)'
    );
  });

  it('should treat triple semicolon lines as commented when toggling', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor('(defn foo []•  |;;; header)'),
      '(defn foo []•  |header)'
    );
  });

  it('should uncomment mixed semicolon prefixes across selected lines and preserve selection', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor('(defn foo []•  |; a•  ;; b|)'),
      '(defn foo []•  |a•  b|)'
    );
  });

  it('should preserve nested indentation when uncommenting selected multiline block (issue #3078)', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor(
        '|;; (a (b c•;;       (d e•;;          f)•;;       g•;;       h)•;;    i•;;    j)|'
      ),
      '|(a (b c•      (d e•         f)•      g•      h)•   i•   j)|'
    );
  });

  it('should preserve nested indentation when uncommenting selected multiline block inside defn (issue #3078)', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor(
        '(defn foo []•  |;; (a (b c•  ;;       (d e•  ;;          f)•  ;;       g•  ;;       h)•  ;;    i•  ;;    j)|•     )'
      ),
      '(defn foo []•  |(a (b c•        (d e•           f)•        g•        h)•     i•     j)|)'
    );
  });

  it('should comment an empty line inside assoc with alignment indent (issue #2872)', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor('(assoc m•       :key :val•|)'),
      '(assoc m•       :key :val•       ;; |•       )'
    );
  });

  it('should comment a line in aligned position with correct indent', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor('(assoc m•       :key :val•       |(+ 1 2))'),
      '(assoc m•       :key :val•       ;; |(+ 1 2)•       )'
    );
  });

  it('should uncomment an aligned line and restore alignment', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor('(assoc m•       :key :val•       ;;  |(+ 1 2))'),
      '(assoc m•       :key :val•       |(+ 1 2))'
    );
  });

  it('should handle multiple cursors on different lines and preserve cursor positions', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor('(defn foo []•  |(println "a")•  |1(println "b"))'),
      '(defn foo []•  ;; |(println "a")•  ;; |1(println "b"))'
    );
  });

  it('should uncomment multiple lines with correct indentation and preserve selections', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor(
        '(defn foo []•  ;; |(println "a")•  ;; |1(println "b"))'
      ),
      '(defn foo []•  |(println "a")•  |1(println "b"))'
    );
  });

  it('should comment at top level with zero indent', async () => {
    assert.equal(await toggleCommentUsingActiveEditor('|(defn foo [])'), ';; |(defn foo [])');
  });

  it('should comment inside let binding vector with alignment', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor('(let [x 1•      |y 2]•  x)'),
      '(let [x 1•      ;; |y 2•      ]•  x)'
    );
  });

  it('should handle nested forms with correct indent', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor('(defn foo []•  (when true•    |(+ 1 2)))'),
      '(defn foo []•  (when true•    ;; |(+ 1 2)•    ))'
    );
  });

  it('should comment a complete multi-line top-level form without structural breaks and preserve selection', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor('|(defn foo []•  (prn "hi"))|'),
      '|;; (defn foo []•;;   (prn "hi"))|'
    );
  });

  it('should comment selected lines inside a containing form, preserving outside closers and selection', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor('(do•  |(prn "a")•  (prn "b")|)'),
      '(do•  |;; (prn "a")•  ;; (prn "b")|•  )'
    );
  });

  it('should comment multi-line nested forms when all lines selected and preserve selection', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor('|(do•  (prn "a")•  (prn "b"))|'),
      '|;; (do•;;   (prn "a")•;;   (prn "b"))|'
    );
  });

  it('should comment complete multi-line let binding without displacing bracket and preserve selection', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor('|(let [a 1•        b 2])|'),
      '|;; (let [a 1•;;         b 2])|'
    );
  });

  it('should structurally comment two selected lines and preserve closing delimiter and selection', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor('(assoc {}•         |:a•         :b|)'),
      '(assoc {}•         |;; :a•         ;; :b|•         )'
    );
  });

  it('should preserve indentation and structure for selected multiline expression in with-open', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor(
        '(ns main.server•  #_(:require [babashka.fs :as fs])•  (:gen-class))••(defn -main•  "I don\'t do a whole lot ... yet."•  [& _args]•  (println "Hello, World!"))••(comment•  (-main)•  (System/getProperty "user.dir")•  (rand-int 100)•  (with-open [r (java.io.FileInputStream. "/dev/urandom")]•    |(mod (->> #(.read r)•              repeatedly•              (filter #(not (>= % 200)))•              (take 1)•              doall•              first)•         100)|)•  :rcf)'
      ),
      '(ns main.server•  #_(:require [babashka.fs :as fs])•  (:gen-class))••(defn -main•  "I don\'t do a whole lot ... yet."•  [& _args]•  (println "Hello, World!"))••(comment•  (-main)•  (System/getProperty "user.dir")•  (rand-int 100)•  (with-open [r (java.io.FileInputStream. "/dev/urandom")]•    |;; (mod (->> #(.read r)•    ;;           repeatedly•    ;;           (filter #(not (>= % 200)))•    ;;           (take 1)•    ;;           doall•    ;;           first)•    ;;      100)|•         )•  :rcf)'
    );
  });

  it('should structurally comment multiline partial selection and keep full selection over commented text', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor('(a |(b c•      d)|•   e)'),
      '(a |;; (b c•   ;;    d)|•   e)'
    );
  });

  it('should structurally comment multiline selection nested in parent form and preserve full selected range', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor('(x•  (y |(a b•        c)|)•  z)'),
      '(x•  (y |;; (a b•     ;;    c)|•        )•  z)'
    );
  });

  it('should structurally comment multiline selection nested in j/y forms and keep full selected range', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor('(x• (j |(y •     (a b c))|)• z)'),
      '(x• (j |;; (y •    ;;  (a b c))|•     )• z)'
    );
  });

  it('should insert structural comment at selection start for single-line nested selection', async () => {
    assert.equal(
      await toggleCommentUsingActiveEditor('(x• (j (y |(a b c)|))• z)'),
      '(x• (j (y |;; (a b c)|•     ))• z)'
    );
  });
});
