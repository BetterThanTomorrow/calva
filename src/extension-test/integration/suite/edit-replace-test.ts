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
    // Open the other file in Column One first — establishes the editor group
    await testUtil.openFile(otherFilePath);

    // Open the target file in Column Two — capture a fresh editor reference
    const targetDoc = await vscode.workspace.openTextDocument(vscode.Uri.file(targetFilePath));
    const targetEditor = await vscode.window.showTextDocument(targetDoc, {
      viewColumn: vscode.ViewColumn.Two,
      preview: false,
    });

    // Wait for the mirror doc to be available for the target file
    await testUtil.waitForCondition(
      () => {
        try {
          docMirror.getDocument(targetDoc);
          return true;
        } catch {
          return false;
        }
      },
      4000,
      50,
      'Timed out waiting for mirror document for target file'
    );

    // Focus back to Column One so activeTextEditor is the other file
    await vscode.commands.executeCommand('workbench.action.focusFirstEditorGroup');
    await testUtil.waitForCondition(
      () => vscode.window.activeTextEditor?.document.uri.fsPath === otherFilePath,
      4000,
      50,
      'Timed out waiting for focus to return to other file'
    );

    // Confirm precondition: active editor is NOT the target file
    const activeEditor = vscode.window.activeTextEditor;
    assert.ok(activeEditor, 'There should be an active editor');
    assert.strictEqual(
      activeEditor.document.uri.fsPath,
      otherFilePath,
      'Precondition: active editor should be the other file'
    );

    const targetContentBefore = targetDoc.getText();
    const otherContentBefore = activeEditor.document.getText();

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
    const targetContentAfter = targetDoc.getText();
    assert.ok(
      targetContentAfter.includes('(def a 42)'),
      `Target file should contain the replacement text. Got: ${targetContentAfter}`
    );
    assert.ok(
      !targetContentAfter.includes('(def a 1)'),
      `Target file should no longer contain the original text. Got: ${targetContentAfter}`
    );

    // The active editor's file should be unchanged
    const otherContentAfter = activeEditor.document.getText();
    assert.strictEqual(
      otherContentAfter,
      otherContentBefore,
      'Active editor content should be unchanged'
    );
  });
});
