import * as vscode from 'vscode';
import * as assert from 'assert';
import * as path from 'path';
import * as mocha from 'mocha';
import * as jackIn from '../../../nrepl/jack-in';
import * as connectSequenceTypes from '../../../nrepl/connect-sequence-types';
import * as replSession from '../../../nrepl/repl-session';
import * as outputWindow from '../../../repl-window/repl-window-doc';
import * as testUtil from './util';

const suiteName = 'Completion Provider';
const testFilePath = path.join(testUtil.testDataDir, 'repl_completion.clj');
const testFileUri = vscode.Uri.file(testFilePath);
const connectSequence: connectSequenceTypes.ReplConnectSequence = {
  projectType: connectSequenceTypes.ProjectTypes['deps.edn'],
  name: 'deps.edn',
  cljsType: connectSequenceTypes.CljsTypes.none,
  projectRootPath: [path.join(testUtil.testDataDir, '..')],
  menuSelections: { cljAliases: [] },
};

async function completionItemsAt(line: number, character: number, resolveCount = 0) {
  const list = await vscode.commands.executeCommand<vscode.CompletionList>(
    'vscode.executeCompletionItemProvider',
    testFileUri,
    new vscode.Position(line, character),
    undefined,
    resolveCount
  );
  return list.items;
}

function labelOf(item: vscode.CompletionItem) {
  return typeof item.label === 'string' ? item.label : item.label.label;
}

suite('Completion Provider Test', () => {
  const jackInHarness = new testUtil.JackInHarness(suiteName);
  let originalDestinations: any;

  mocha.before(async function () {
    this.timeout(120_000);
    testUtil.showMessage(suiteName, 'suite starting!');
    await testUtil.ensureOutputDir(testUtil.testDataDir);
    const config = vscode.workspace.getConfiguration('calva');
    originalDestinations = config.inspect('outputDestinations')?.globalValue;
    await config.update(
      'outputDestinations',
      { evalResults: 'terminal', evalOutput: 'terminal', otherOutput: 'terminal' },
      vscode.ConfigurationTarget.Global
    );
    await outputWindow.clearReplWindowDoc();
    await jackInHarness.disconnectAllClients();
    await jackInHarness.jackInWithConnectSequence(testFilePath, connectSequence);
    await testUtil.openFile(testFilePath);
    await vscode.commands.executeCommand('calva.loadFile');
    await replSession
      .getSession()
      .eval('(defn only-in-repl-fn "Lives only in the REPL." [x] x)', 'repl-completion').value;
  });

  mocha.after(async () => {
    await vscode.workspace
      .getConfiguration('calva')
      .update('outputDestinations', originalDestinations, vscode.ConfigurationTarget.Global);
    testUtil.log(suiteName, 'Suite cleanup: killing all jack-in processes');
    await jackIn.calvaJackout({ force: true });
    await testUtil.waitForJackOutComplete(suiteName);
    testUtil.showMessage(suiteName, 'suite done!');
  });

  test('completes an alias from the REPL', async function () {
    const items = await testUtil.waitForValue(
      async () => {
        const items = await completionItemsAt(7, 13);
        return items.some((item) => labelOf(item) === 'string/upper-case') ? items : undefined;
      },
      10_000,
      200,
      'Expected string/upper-case among the completions'
    );
    const item = items.find((item) => labelOf(item) === 'string/upper-case');
    assert.strictEqual(item.kind, vscode.CompletionItemKind.Function);
  });

  test('completes a var that only the REPL knows, and resolves its arglist', async function () {
    const items = await completionItemsAt(8, 12, 10);
    const item = items.find((item) => labelOf(item) === 'only-in-repl-fn');
    assert.ok(item, `Expected only-in-repl-fn among ${items.map(labelOf).join(', ')}`);
    assert.strictEqual(item.kind, vscode.CompletionItemKind.Function);
    assert.ok(
      item.detail?.includes('[x]'),
      `Expected the arglist in the detail, got ${item.detail}`
    );
  });
});
