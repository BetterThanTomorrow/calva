import * as vscode from 'vscode';
import * as assert from 'assert';
import * as path from 'path';
import * as mocha from 'mocha';
import * as jackIn from '../../../nrepl/jack-in';
import * as connectSequenceTypes from '../../../nrepl/connect-sequence-types';
import * as outputWindow from '../../../repl-window/repl-window-doc';
import * as testUtil from './util';

const suiteName = 'Definition Provider';
const testFilePath = path.join(testUtil.testDataDir, 'repl_completion.clj');
const testFileUri = vscode.Uri.file(testFilePath);
const connectSequence: connectSequenceTypes.ReplConnectSequence = {
  projectType: connectSequenceTypes.ProjectTypes['deps.edn'],
  name: 'deps.edn',
  cljsType: connectSequenceTypes.CljsTypes.none,
  projectRootPath: [path.join(testUtil.testDataDir, '..')],
  menuSelections: { cljAliases: [] },
};

async function setPriority(priority: string[] | undefined) {
  await vscode.workspace
    .getConfiguration('calva')
    .update('definitionProviderPriority', priority, vscode.ConfigurationTarget.Global);
  await testUtil.waitForCondition(
    () =>
      priority === undefined ||
      JSON.stringify(
        vscode.workspace.getConfiguration('calva').get('definitionProviderPriority')
      ) === JSON.stringify(priority),
    2000,
    50,
    'definitionProviderPriority config update did not take effect'
  );
}

async function definitionsAt(line: number, character: number) {
  const locations = await vscode.commands.executeCommand<(vscode.Location | vscode.LocationLink)[]>(
    'vscode.executeDefinitionProvider',
    testFileUri,
    new vscode.Position(line, character)
  );
  return locations.map((location) =>
    location instanceof vscode.Location
      ? { uri: location.uri, line: location.range.start.line }
      : { uri: location.targetUri, line: location.targetRange.start.line }
  );
}

suite('Definition Provider Test', () => {
  const jackInHarness = new testUtil.JackInHarness(suiteName);
  let originalDestinations: any;
  let originalPriority: any;

  mocha.before(async function () {
    this.timeout(120_000);
    testUtil.showMessage(suiteName, 'suite starting!');
    await testUtil.ensureOutputDir(testUtil.testDataDir);
    const config = vscode.workspace.getConfiguration('calva');
    originalDestinations = config.inspect('outputDestinations')?.globalValue;
    originalPriority = config.inspect('definitionProviderPriority')?.globalValue;
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
  });

  mocha.after(async () => {
    await vscode.workspace
      .getConfiguration('calva')
      .update('outputDestinations', originalDestinations, vscode.ConfigurationTarget.Global);
    await setPriority(originalPriority);
    testUtil.log(suiteName, 'Suite cleanup: killing all jack-in processes');
    await jackIn.calvaJackout({ force: true });
    await testUtil.waitForJackOutComplete(suiteName);
    testUtil.showMessage(suiteName, 'suite done!');
  });

  for (const priority of [
    ['repl', 'lsp'],
    ['lsp', 'repl'],
  ]) {
    test(`finds a definition in a jar, with ${priority[0]} first`, async function () {
      await setPriority(priority);
      const definitions = await definitionsAt(9, 6);
      assert.ok(
        definitions.some((d) => d.uri.toString().endsWith('clojure/string.clj')),
        `Expected clojure/string.clj, got ${JSON.stringify(definitions)}`
      );
    });

    test(`finds a definition in the same file, with ${priority[0]} first`, async function () {
      await setPriority(priority);
      const definitions = await definitionsAt(10, 5);
      assert.deepStrictEqual(
        definitions.map((d) => [d.uri.fsPath, d.line]),
        [[testFilePath, 3]]
      );
    });
  }
});
