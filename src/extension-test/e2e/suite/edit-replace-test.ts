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

  suite('Editor-less API', function () {
    async function openDocWithMirror(): Promise<vscode.TextDocument> {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(targetFilePath));
      await testUtil.waitForCondition(
        () => {
          try {
            docMirror.getDocument(doc);
            return true;
          } catch {
            return false;
          }
        },
        4000,
        50,
        'Timed out waiting for mirror document (no editor)'
      );
      return doc;
    }

    test('edit.replace applies edit via TextDocument', async function () {
      const targetDoc = await openDocWithMirror();

      const range = new vscode.Range(
        new vscode.Position(2, 0),
        new vscode.Position(2, '(def a 1)'.length)
      );
      const result = await edit.replace(targetDoc, range, '(def a 42)', {
        skipFormat: true,
      });

      assert.strictEqual(result, true, 'edit.replace should return true');
      const content = targetDoc.getText();
      assert.ok(content.includes('(def a 42)'), `Should contain replacement. Got: ${content}`);
      assert.ok(!content.includes('(def a 1)'), `Should not contain original. Got: ${content}`);
    });

    test('ranges.currentForm resolves with TextDocument + Position', async function () {
      const targetDoc = await openDocWithMirror();

      // Position on the opening paren — currentForm returns the whole list
      const pos = new vscode.Position(2, 0);
      const [formRange, formText] = ranges.currentForm(targetDoc, pos);
      assert.ok(formRange, 'should return a range');
      assert.strictEqual(formText, '(def a 1)', `should return the form. Got: ${formText}`);
    });

    test('ranges.currentTopLevelForm resolves with TextDocument + Position', async function () {
      const targetDoc = await openDocWithMirror();

      // Position inside a symbol — currentTopLevelForm still returns the enclosing def
      const pos = new vscode.Position(2, 5);
      const [formRange, formText] = ranges.currentTopLevelForm(targetDoc, pos);
      assert.ok(formRange, 'should return a range');
      assert.strictEqual(
        formText,
        '(def a 1)',
        `should return the top-level form. Got: ${formText}`
      );
    });

    test('ranges.currentEnclosingForm resolves with TextDocument + Position', async function () {
      const targetDoc = await openDocWithMirror();

      // Position on symbol 'a' — enclosing form is (def a 1)
      const pos = new vscode.Position(2, 5);
      const [formRange, formText] = ranges.currentEnclosingForm(targetDoc, pos);
      assert.ok(formRange, 'should return a range');
      assert.strictEqual(
        formText,
        '(def a 1)',
        `should return the enclosing form. Got: ${formText}`
      );
    });

    test('edit then ranges: doc mirror reflects the edit', async function () {
      const targetDoc = await openDocWithMirror();

      // Replace (def a 1) with (def a 42)
      const range = new vscode.Range(
        new vscode.Position(2, 0),
        new vscode.Position(2, '(def a 1)'.length)
      );
      await edit.replace(targetDoc, range, '(def a 42)', { skipFormat: true });

      // Range query on the edited content should see the new form
      const pos = new vscode.Position(2, 0);
      const [, formText] = ranges.currentForm(targetDoc, pos);
      assert.strictEqual(
        formText,
        '(def a 42)',
        `After edit, form should be updated. Got: ${formText}`
      );
    });

    test('edit.replace edits the target document, not the active editor', async function () {
      const targetDoc = await openDocWithMirror();

      // Open a different file as the active editor
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

      const otherContentBefore = vscode.window.activeTextEditor.document.getText();

      // Edit the target via TextDocument (no skipFormat — the exact scenario that was buggy)
      const range = new vscode.Range(
        new vscode.Position(2, 0),
        new vscode.Position(2, '(def a 1)'.length)
      );
      const result = await edit.replace(targetDoc, range, '(def a 42)');

      assert.strictEqual(result, true, 'edit.replace should return true');

      // Target document should have the edit
      const targetContent = targetDoc.getText();
      assert.ok(
        targetContent.includes('(def a 42)'),
        `Target should contain replacement. Got: ${targetContent}`
      );

      // Active editor's document should be untouched
      const otherContentAfter = vscode.window.activeTextEditor.document.getText();
      assert.strictEqual(
        otherContentAfter,
        otherContentBefore,
        'Active editor content should be unchanged when editing via TextDocument'
      );
    });
  });
});
