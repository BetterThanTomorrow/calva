import * as assert from 'assert';
import * as path from 'path';
import * as testUtil from './util';
import * as vscode from 'vscode';
import * as edit from '../../../edit';
import * as docMirror from '../../../doc-mirror';

const suiteName = 'Edit Replace Suite';

const targetFilePath = path.join(testUtil.testDataDir, 'edit-replace-target.clj');
const otherFilePath = path.join(testUtil.testDataDir, 'reformattable.clj');

suite(suiteName, function () {
  let targetEditor: vscode.TextEditor;
  let otherEditor: vscode.TextEditor;

  setup(async function () {
    // Open the target file in a second column without focusing it
    const targetDoc = await vscode.workspace.openTextDocument(vscode.Uri.file(targetFilePath));
    targetEditor = await vscode.window.showTextDocument(targetDoc, {
      viewColumn: vscode.ViewColumn.Two,
      preserveFocus: true,
      preview: false,
    });

    // Open a different file as the active editor
    otherEditor = await testUtil.openFile(otherFilePath);

    // Wait for the mirror doc to be available for the target file
    await testUtil.waitForCondition(
      () => {
        try {
          docMirror.getDocument(targetEditor.document);
          return true;
        } catch {
          return false;
        }
      },
      4000,
      50,
      'Timed out waiting for mirror document for target file'
    );
  });

  teardown(async function () {
    // Revert target file to original content
    const targetDoc = await vscode.workspace.openTextDocument(vscode.Uri.file(targetFilePath));
    const fullRange = new vscode.Range(
      new vscode.Position(0, 0),
      targetDoc.positionAt(targetDoc.getText().length)
    );
    const editor = await vscode.window.showTextDocument(targetDoc);
    await editor.edit((builder) => {
      builder.replace(fullRange, '(ns edit-replace-target)\n\n(def a 1)\n\n(def b 2)\n');
    });
    await targetDoc.save();
  });

  test('should apply edit to the passed editor, not activeTextEditor', async function () {
    // Confirm precondition: active editor is NOT the target file
    const activeFileBefore = vscode.window.activeTextEditor?.document.uri.fsPath;
    assert.strictEqual(
      activeFileBefore,
      otherFilePath,
      'Precondition: active editor should be the other file'
    );
    assert.notStrictEqual(
      activeFileBefore,
      targetFilePath,
      'Precondition: active editor should NOT be the target file'
    );

    const targetContentBefore = targetEditor.document.getText();
    const otherContentBefore = otherEditor.document.getText();

    // Call edit.replace with the target editor (which is NOT activeTextEditor)
    const range = new vscode.Range(
      new vscode.Position(2, 0),
      new vscode.Position(2, '(def a 1)'.length)
    );
    const result = await edit.replace(targetEditor, range, '(def a 42)', {
      skipFormat: true,
    });

    assert.strictEqual(result, true, 'edit.replace should return true');

    // The edit should have gone to the target file
    const targetContentAfter = targetEditor.document.getText();
    assert.ok(
      targetContentAfter.includes('(def a 42)'),
      `Target file should contain the replacement text. Got: ${targetContentAfter}`
    );
    assert.ok(
      !targetContentAfter.includes('(def a 1)'),
      `Target file should no longer contain the original text. Got: ${targetContentAfter}`
    );

    // The active editor's file should be unchanged
    const otherContentAfter = otherEditor.document.getText();
    assert.strictEqual(
      otherContentAfter,
      otherContentBefore,
      'Active editor content should be unchanged'
    );
  });
});
