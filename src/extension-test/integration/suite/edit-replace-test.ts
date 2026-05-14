import * as assert from 'assert';
import * as path from 'path';
import * as testUtil from './util';
import * as vscode from 'vscode';
import * as edit from '../../../edit';
import * as docMirror from '../../../doc-mirror';
import * as ranges from '../../../api/ranges';

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

    // Show the other file in Column One — explicitly setting viewColumn
    // ensures it opens in a different group and becomes activeTextEditor
    const otherDoc = await vscode.workspace.openTextDocument(vscode.Uri.file(otherFilePath));
    await vscode.window.showTextDocument(otherDoc, {
      viewColumn: vscode.ViewColumn.One,
      preview: false,
    });
    await testUtil.waitForCondition(
      () => vscode.window.activeTextEditor?.document.uri.fsPath === otherFilePath,
      4000,
      50,
      'Timed out waiting for other file to become active'
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

  test('should apply edit via TextDocument without a visible editor', async function () {
    // Open the target file as a TextDocument only — no showTextDocument()
    const targetDoc = await vscode.workspace.openTextDocument(vscode.Uri.file(targetFilePath));

    // Wait for the mirror doc to be available
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
      'Timed out waiting for mirror document for target file (no editor)'
    );

    // Call edit.replace with a TextDocument (not a TextEditor)
    const range = new vscode.Range(
      new vscode.Position(2, 0),
      new vscode.Position(2, '(def a 1)'.length)
    );
    const result = await edit.replace(targetDoc, range, '(def a 42)', {
      skipFormat: true,
    });

    assert.strictEqual(result, true, 'edit.replace should return true');

    // The edit should have been applied to the document
    const targetContentAfter = targetDoc.getText();
    assert.ok(
      targetContentAfter.includes('(def a 42)'),
      `Target file should contain the replacement text. Got: ${targetContentAfter}`
    );
    assert.ok(
      !targetContentAfter.includes('(def a 1)'),
      `Target file should no longer contain the original text. Got: ${targetContentAfter}`
    );

    // Verify range query works on a TextDocument without a visible editor
    const pos = new vscode.Position(2, 5); // inside (def a 42)
    const [formRange, formText] = ranges.currentForm(targetDoc, pos);
    assert.ok(formRange, 'currentForm should return a range for a document with no visible editor');
    assert.ok(formText, 'currentForm should return text for a document with no visible editor');
    assert.ok(formText.includes('def'), `currentForm text should contain 'def'. Got: ${formText}`);
  });
});
