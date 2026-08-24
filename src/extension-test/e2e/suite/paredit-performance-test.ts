import * as assert from 'assert';
import * as vscode from 'vscode';
import * as highlight from '../../../highlight/src/extension';
import * as testUtil from './util';

async function measureCommandAndDecorations(
  editor: vscode.TextEditor,
  command: string
): Promise<number> {
  let resolveSelectionChange: () => void;
  const selectionChanged = new Promise<void>((resolve) => {
    resolveSelectionChange = resolve;
  });
  const listener = vscode.window.onDidChangeTextEditorSelection((event) => {
    if (event.textEditor === editor) {
      listener.dispose();
      resolveSelectionChange();
    }
  });
  const startedAt = performance.now();

  try {
    await vscode.commands.executeCommand(command);
    await selectionChanged;
    // The highlighter schedules active-indent decorations after 16 ms. Waiting
    // past that debounce includes the decoration pass in the measurement.
    await testUtil.sleep(32);
    return performance.now() - startedAt;
  } finally {
    listener.dispose();
  }
}

suite('Paredit performance suite', () => {
  test('many cursors remain responsive', async function () {
    await vscode.extensions.getExtension('betterthantomorrow.calva')?.activate();

    const itemCount = 250;
    const items = Array.from({ length: itemCount }, (_, i) => `  ${String(i).padStart(5, '0')}`);
    const document = await vscode.workspace.openTextDocument({
      language: 'clojure',
      content: `[\n${items.join('\n')}\n]`,
    });
    const editor = await vscode.window.showTextDocument(document);

    try {
      await testUtil.waitForCondition(() => highlight.activeEditor?.document === document);

      const start = document.positionAt(2);
      const end = document.positionAt(document.getText().lastIndexOf('\n'));
      editor.selection = new vscode.Selection(start, end);

      await vscode.commands.executeCommand('editor.action.insertCursorAtEndOfEachLineSelected');
      assert.strictEqual(editor.selections.length, itemCount);

      // Allow the selection-change/highlight debounce to run before measuring
      // a command that must compete with the active-indent decorations.
      await testUtil.sleep(250);
      const elapsedMs = await measureCommandAndDecorations(editor, 'cursorRight');
      testUtil.log(
        'Paredit performance',
        `cursor movement and decoration took ${elapsedMs.toFixed(0)}ms with ${itemCount} cursors`
      );

      assert.ok(
        elapsedMs < 1000,
        `cursor movement and decoration took ${elapsedMs.toFixed(0)}ms with ${itemCount} cursors`
      );
    } finally {
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    }
  });
});
