import * as assert from 'assert';
import * as mocha from 'mocha';
import * as path from 'path';
import * as testUtil from './util';
import * as vscode from 'vscode';
import * as textNotation from '../integration-text-notation';

const suiteName = 'Insert Semicolon Suite';
const testFilePath = path.join(testUtil.testDataDir, 'reformattable.clj');

function getText(doc: vscode.TextDocument, replaceNewLine = false): string {
  const text = doc.getText(
    doc.validateRange(
      new vscode.Range(new vscode.Position(0, 0), new vscode.Position(99999, 99999))
    )
  );
  return replaceNewLine ? text.split(doc.eol === 1 ? '\n' : '\r\n').join('•') : text;
}

function textNotationFromDocAndSelections(
  doc: vscode.TextDocument,
  selections: readonly vscode.Selection[]
): string {
  const ranges: [number, number][] = selections.map((selection) => [
    doc.offsetAt(selection.anchor),
    doc.offsetAt(selection.active),
  ]);
  return textNotation.textNotationFromTextAndSelections(getText(doc, true), ranges, false);
}

function createSelectionFromOffsets(
  editor: vscode.TextEditor,
  [anchorOffset, activeOffset]: [number, number]
): vscode.Selection {
  return new vscode.Selection(
    editor.document.positionAt(anchorOffset),
    editor.document.positionAt(activeOffset)
  );
}

async function waitForNotation(
  editor: vscode.TextEditor,
  expectedNotation: string,
  timeoutMs = 2000
): Promise<void> {
  await testUtil.waitForCondition(
    () => textNotationFromDocAndSelections(editor.document, editor.selections) === expectedNotation,
    timeoutMs,
    20,
    `Timed out waiting for editor notation ${JSON.stringify(expectedNotation)}`
  );
}

async function resetEditor(editor: vscode.TextEditor, textAndSelections: string): Promise<void> {
  const [text, selectionsAsOffsets] =
    textNotation.textNotationToTextAndSelection(textAndSelections);
  const fullRange = editor.document.validateRange(
    new vscode.Range(new vscode.Position(0, 0), new vscode.Position(99999, 99999))
  );

  await editor.edit((editBuilder) => {
    editBuilder.replace(fullRange, text);
  });

  editor.selections = selectionsAsOffsets.map((selection) =>
    createSelectionFromOffsets(editor, selection)
  );

  await waitForNotation(editor, textAndSelections);
}

async function undoOnce(editor: vscode.TextEditor): Promise<void> {
  await vscode.window.showTextDocument(editor.document);
  await testUtil.waitForCondition(
    () =>
      vscode.window.activeTextEditor?.document.uri.toString() === editor.document.uri.toString(),
    2000,
    20,
    'Timed out waiting for editor to become active before undo'
  );
  await vscode.commands.executeCommand('default:undo');
}

suite(suiteName, () => {
  mocha.before(async () => {
    testUtil.showMessage(suiteName, 'suite starting');
    await testUtil.openFile(testFilePath);
  });

  mocha.after(async () => {
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    testUtil.showMessage(suiteName, 'suite done!');
  });

  mocha.it(
    'undo once restores pre-command state for structure-preserving insertSemiColon',
    async () => {
      const editor = vscode.window.activeTextEditor;
      const initialState = '(defn foo []•  |(println "test"))';
      const expectedAfterInsert = '(defn foo []•  ;|(println "test")•  )';

      await resetEditor(editor, initialState);

      await vscode.commands.executeCommand('paredit.insertSemiColon');
      await waitForNotation(editor, expectedAfterInsert);

      assert.equal(
        textNotationFromDocAndSelections(editor.document, editor.selections),
        expectedAfterInsert
      );

      await undoOnce(editor);
      await waitForNotation(editor, initialState);

      assert.equal(
        textNotationFromDocAndSelections(editor.document, editor.selections),
        initialState
      );
    }
  );

  mocha.it(
    'keeps closing delimiter outside the inserted comment when cursor is before close',
    async () => {
      const editor = vscode.window.activeTextEditor;
      const initialState = '(bar 24 |)';
      const expectedAfterInsert = '(bar 24 ;|•     )';

      await resetEditor(editor, initialState);

      await vscode.commands.executeCommand('paredit.insertSemiColon');
      await waitForNotation(editor, expectedAfterInsert);

      assert.equal(
        textNotationFromDocAndSelections(editor.document, editor.selections),
        expectedAfterInsert
      );
    }
  );
});
