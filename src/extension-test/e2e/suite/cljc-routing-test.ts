import * as assert from 'assert';
import * as mocha from 'mocha';
import * as path from 'path';
import * as testUtil from './util';
import * as clientRegistry from '../../../nrepl/client-registry';
import * as sessionRegistry from '../../../nrepl/session-registry';
import * as replSession from '../../../nrepl/repl-session';
import * as jackIn from '../../../nrepl/jack-in';
import * as vscode from 'vscode';
import * as connector from '../../../connector';
import * as lsp from '../../../lsp';
import { HoverProvider } from '../../../providers/hover';
import { CalvaCompletionItemProvider } from '../../../providers/completion';

const suiteName = 'CLJC Routing';

// Project paths - computed once
const projectDir = path.join(testUtil.testDataDir, '..', 'projects', 'cljs-only');
const cljsFile = path.join(projectDir, 'src', 'hello_world', 'core.cljs');
const cljcFile = path.join(projectDir, 'src', 'hello_world', 'core.cljc');
const ednFile = path.join(projectDir, 'deps.edn');
const fiddleFile = path.join(projectDir, 'hello.fiddle');

// Files outside the connected project (in test-data/integration-test)
const outsideCljcFile = path.join(testUtil.testDataDir, 'test.cljc');
const outsideFiddleFile = path.join(testUtil.testDataDir, 'test.fiddle');

async function showInColumn(filePath: string, column: vscode.ViewColumn) {
  const document = await vscode.workspace.openTextDocument(filePath);
  await vscode.window.showTextDocument(document, column);
  await testUtil.waitForCondition(
    () => vscode.window.activeTextEditor?.document === document,
    4000,
    20,
    `Timed out waiting for ${filePath} to be the active editor`
  );
  return document;
}

async function replHoverName(document: vscode.TextDocument, position: vscode.Position) {
  const hover = await new HoverProvider(lsp.getClientProvider()).provideHover(
    document,
    position,
    undefined
  );
  return (hover?.contents[0] as vscode.MarkdownString)?.value.match(/```clojure\n(.*)\n```/)?.[1];
}

async function replCompletionLabels(document: vscode.TextDocument, position: vscode.Position) {
  const list = await new CalvaCompletionItemProvider(
    lsp.getClientProvider()
  ).provideCompletionItems(document, position, new vscode.CancellationTokenSource().token, {
    triggerKind: vscode.CompletionTriggerKind.Invoke,
    triggerCharacter: undefined,
  });
  return list.items
    .filter((item) => item['data']?.provider === 'repl')
    .map((item) => (typeof item.label === 'string' ? item.label : item.label.label));
}

async function waitForRouting(expectedSessionKey: string, reasonType: string): Promise<void> {
  await testUtil.waitForCondition(
    () => {
      const routingInfo = replSession.getRoutingInfo();
      return (
        routingInfo?.sessionKey === expectedSessionKey && routingInfo.reason.type === reasonType
      );
    },
    2000,
    20,
    `Timed out waiting for routing ${reasonType} -> ${expectedSessionKey}`
  );
}

suite('CLJC Routing suite', function () {
  // Increase timeout for the entire suite since we jack-in once
  this.timeout(180_000);

  let clientKey: string;

  mocha.before(async () => {
    testUtil.showMessage(suiteName, `suite starting!`);
    await testUtil.ensureOutputDir(testUtil.testDataDir);

    // Clean up any stale clients
    const existingClients = clientRegistry.listClients();
    for (const client of existingClients) {
      try {
        await connector.disconnect({ clientKey: client.key });
      } catch {
        // Ignore errors during cleanup
      }
    }

    // Jack-in once for all tests
    await jackInToClojureScriptProject();

    // Verify we have both clj and cljs sessions
    const clients = clientRegistry.listClients();
    assert.strictEqual(clients.length, 1, 'Should have one client after jack-in');
    clientKey = clients[0].key;

    const sessions = sessionRegistry.listSessionsByClient(clientKey);
    const sessionKeys = sessions.map((s) => s.key);
    testUtil.log(suiteName, 'Session keys:', sessionKeys);

    assert.ok(sessionKeys.includes('clj'), 'Should have clj session');
    assert.ok(sessionKeys.includes('cljs'), 'Should have cljs session');
  });

  mocha.after(async () => {
    testUtil.showMessage(suiteName, `suite done!`);

    // Kill jack-in processes to prevent orphaned Java processes
    testUtil.log(suiteName, 'Suite cleanup: killing all jack-in processes');
    await jackIn.calvaJackout({ force: true });
    await testUtil.waitForJackOutComplete(suiteName);

    // Disconnect after all tests
    const clients = clientRegistry.listClients();
    for (const client of clients) {
      try {
        await connector.disconnect({ clientKey: client.key });
      } catch {
        // Ignore errors during cleanup
      }
    }
  });

  mocha.beforeEach(() => {
    // Reset cljc target to primary before each test
    clientRegistry.setCljcTargetForConnection(clientKey, 'primary');
  });

  test('Routes .edn files to clj session via glob match', async function () {
    testUtil.log(suiteName, 'Testing: Routes .edn files to clj session');

    await testUtil.openFile(ednFile);

    const routingInfo = replSession.getRoutingInfo();
    testUtil.log(suiteName, 'Routing info for .edn file:', routingInfo);

    assert.strictEqual(routingInfo?.sessionKey, 'clj', '.edn file should route to clj session');
    assert.strictEqual(routingInfo?.reason.type, 'glob-match', '.edn should route via glob-match');
  });

  test('Routes .cljs files to cljs session via glob match', async function () {
    testUtil.log(suiteName, 'Testing: Routes .cljs files to cljs session');

    await testUtil.openFile(cljsFile);

    const routingInfo = replSession.getRoutingInfo();
    testUtil.log(suiteName, 'Routing info for .cljs file:', routingInfo);

    assert.strictEqual(routingInfo?.sessionKey, 'cljs', '.cljs file should route to cljs session');
    assert.strictEqual(routingInfo?.reason.type, 'glob-match', '.cljs should route via glob-match');
  });

  test('Routes .cljc files using cljc-within-connection routing', async function () {
    testUtil.log(suiteName, 'Testing: Routes .cljc files using cljc target preference');

    await testUtil.openFile(cljcFile);

    const routingInfo = replSession.getRoutingInfo();
    testUtil.log(suiteName, 'Routing for .cljc file:', routingInfo);

    assert.strictEqual(
      routingInfo?.reason.type,
      'cljc-within-connection',
      '.cljc file should use cljc-within-connection routing'
    );

    // Default cljc target is 'primary' which maps to clj
    const target = clientRegistry.getCljcTargetForConnection(clientKey);
    assert.strictEqual(target, 'primary', 'Default cljc target should be primary');
    assert.strictEqual(routingInfo?.sessionKey, 'clj', '.cljc should route to clj (primary)');
  });

  test('Routes a document that is not the active editor the way it routes it when it is', async function () {
    testUtil.log(suiteName, 'Testing: Routing for a given document');

    const cljcEditor = await testUtil.openFile(cljcFile);
    const routingWhenActive = replSession.getRoutingInfo();

    await testUtil.openFile(cljsFile);
    const routingWhenNotActive = replSession.getRoutingInfo(cljcEditor.document);
    testUtil.log(
      suiteName,
      'Routing for the .cljc document from a .cljs editor:',
      routingWhenNotActive
    );

    assert.deepStrictEqual(
      routingWhenNotActive,
      routingWhenActive,
      'The .cljc document should route the same with a .cljs editor active'
    );
    assert.strictEqual(
      replSession.getRoutingInfo()?.sessionKey,
      'cljs',
      'Without a document, routing follows the active .cljs editor'
    );
  });

  test('Routes a file by its URI, without opening it, the way it routes its document', async function () {
    testUtil.log(suiteName, 'Testing: Routing for a file URI');

    for (const target of ['primary', 'secondary'] as const) {
      clientRegistry.setCljcTargetForConnection(clientKey, target);
      for (const file of [cljcFile, cljsFile, ednFile, outsideCljcFile]) {
        const editor = await testUtil.openFile(file);
        assert.deepStrictEqual(
          replSession.getRoutingInfoForUri(vscode.Uri.file(file)),
          replSession.getRoutingInfo(editor.document),
          `${path.basename(file)} should route the same by its URI with the cljc target ${target}`
        );
      }
    }
    assert.deepStrictEqual(
      replSession.getRoutingInfoForUri(undefined),
      replSession.getRoutingInfo(null),
      'Without a URI, routing is the routing without a document'
    );
  });

  test('Hover in a split that is not the active editor answers from that split’s session', async function () {
    testUtil.log(suiteName, 'Testing: Hover in a split that is not the active editor');

    try {
      const cljsDocument = await showInColumn(cljsFile, vscode.ViewColumn.One);
      const cljcDocument = await showInColumn(cljcFile, vscode.ViewColumn.Two);
      assert.strictEqual(
        await replHoverName(cljsDocument, new vscode.Position(10, 2)),
        'cljs.core/comment',
        'Hover in the .cljs split, with the .cljc editor routing to clj active, should ask cljs'
      );

      await showInColumn(cljsFile, vscode.ViewColumn.One);
      assert.strictEqual(
        await replHoverName(cljcDocument, new vscode.Position(2, 2)),
        'clojure.core/comment',
        'Hover in the .cljc split, with the .cljs editor active, should ask clj'
      );

      const markdownDocument = await vscode.workspace.openTextDocument({
        language: 'markdown',
        content: '',
      });
      await vscode.window.showTextDocument(markdownDocument, vscode.ViewColumn.Two);
      assert.strictEqual(
        await replHoverName(cljsDocument, new vscode.Position(10, 2)),
        'cljs.core/comment',
        'Hover in the .cljs split, with a Markdown editor active, should ask cljs'
      );
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    } finally {
      await vscode.commands.executeCommand('workbench.action.joinAllGroups');
    }
  });

  test('Completion in a split that is not the active editor answers from that split’s session', async function () {
    testUtil.log(suiteName, 'Testing: Completion in a split that is not the active editor');

    for (const [sessionKey, userNs] of [
      ['clj', 'user'],
      ['cljs', 'cljs.user'],
    ]) {
      const session = sessionRegistry.getSession(sessionKey);
      await session.eval('(ns hello-world.core)', userNs).value;
      await session.eval(`(defn hello-from-the-${sessionKey}-session [])`, 'hello-world.core')
        .value;
    }

    try {
      const cljsDocument = await showInColumn(cljsFile, vscode.ViewColumn.One);
      await showInColumn(cljcFile, vscode.ViewColumn.Two);
      const labels = await replCompletionLabels(cljsDocument, new vscode.Position(8, 2));
      assert.ok(
        labels.includes('hello-from-the-cljs-session'),
        `The .cljs split should complete from cljs, got ${labels.join(', ')}`
      );
      assert.ok(
        !labels.includes('hello-from-the-clj-session'),
        `The .cljs split should not complete from the active editor’s clj, got ${labels.join(', ')}`
      );
    } finally {
      await vscode.commands.executeCommand('workbench.action.joinAllGroups');
    }
  });

  test('Toggle command switches cljc routing between clj and cljs', async function () {
    testUtil.log(suiteName, 'Testing: Toggle cljc target switches routing');

    await testUtil.openFile(cljcFile);

    // Initial routing should be to clj (primary)
    const initialRouting = replSession.getRoutingInfo();
    assert.strictEqual(initialRouting?.sessionKey, 'clj', 'Initial routing should be clj');

    // Toggle cljc target
    await vscode.commands.executeCommand('calva.toggleCLJCSession');
    await waitForRouting('cljs', 'cljc-within-connection');

    // After toggle, should route to cljs (secondary)
    const afterToggleRouting = replSession.getRoutingInfo();
    testUtil.log(suiteName, 'After toggle routing:', afterToggleRouting);

    assert.strictEqual(
      afterToggleRouting?.sessionKey,
      'cljs',
      'After toggle, .cljc should route to cljs'
    );
    assert.strictEqual(
      clientRegistry.getCljcTargetForConnection(clientKey),
      'secondary',
      'After toggle, cljc target should be secondary'
    );

    // Toggle again - should go back to clj
    await vscode.commands.executeCommand('calva.toggleCLJCSession');
    await waitForRouting('clj', 'cljc-within-connection');

    const afterSecondToggleRouting = replSession.getRoutingInfo();
    assert.strictEqual(
      afterSecondToggleRouting?.sessionKey,
      'clj',
      'After second toggle, .cljc should route back to clj'
    );
  });

  test('Select command sets specific cljc target', async function () {
    testUtil.log(suiteName, 'Testing: Select cljc target command');

    await testUtil.openFile(cljcFile);

    // Select secondary target directly
    await vscode.commands.executeCommand('calva.selectCljcTarget', 'secondary');
    await waitForRouting('cljs', 'cljc-within-connection');

    const afterSelectSecondary = replSession.getRoutingInfo();
    testUtil.log(suiteName, 'After select secondary:', afterSelectSecondary);

    assert.strictEqual(
      afterSelectSecondary?.sessionKey,
      'cljs',
      'After selecting secondary, .cljc should route to cljs'
    );
    assert.strictEqual(
      clientRegistry.getCljcTargetForConnection(clientKey),
      'secondary',
      'Target should be secondary'
    );

    // Select primary target directly
    await vscode.commands.executeCommand('calva.selectCljcTarget', 'primary');
    await waitForRouting('clj', 'cljc-within-connection');

    const afterSelectPrimary = replSession.getRoutingInfo();
    assert.strictEqual(
      afterSelectPrimary?.sessionKey,
      'clj',
      'After selecting primary, .cljc should route to clj'
    );
  });

  test('Fiddle files use cljc routing and respond to toggle', async function () {
    testUtil.log(suiteName, 'Testing: Fiddle files use cljc routing');

    await testUtil.openFile(fiddleFile);

    const initialRouting = replSession.getRoutingInfo();
    testUtil.log(suiteName, 'Routing for .fiddle file:', initialRouting);

    // Fiddle files land in project-fallback tier and should use cljc-within-connection routing
    assert.strictEqual(
      initialRouting?.reason.type,
      'cljc-within-connection',
      '.fiddle file should use cljc-within-connection routing'
    );
    assert.strictEqual(
      initialRouting?.sessionKey,
      'clj',
      '.fiddle file should route to clj (primary)'
    );

    // Toggle and verify it changes
    await vscode.commands.executeCommand('calva.toggleCLJCSession');
    await waitForRouting('cljs', 'cljc-within-connection');

    const afterToggleRouting = replSession.getRoutingInfo();
    assert.strictEqual(
      afterToggleRouting?.sessionKey,
      'cljs',
      'After toggle, .fiddle should route to cljs'
    );
  });

  test('Cljc target changes do not affect .clj and .cljs routing', async function () {
    testUtil.log(suiteName, 'Testing: Cljc target does not affect .clj/.cljs files');

    // Set cljc target to secondary (cljs)
    clientRegistry.setCljcTargetForConnection(clientKey, 'secondary');

    // Open .cljs file - should still route via glob match
    await testUtil.openFile(cljsFile);

    const cljsRouting = replSession.getRoutingInfo();
    testUtil.log(suiteName, '.cljs routing with secondary cljc target:', cljsRouting);

    assert.strictEqual(cljsRouting?.sessionKey, 'cljs', '.cljs should route to cljs');
    assert.strictEqual(
      cljsRouting?.reason.type,
      'glob-match',
      '.cljs should route via glob-match, not cljc preference'
    );

    // Open .edn file - should still route via glob match
    await testUtil.openFile(ednFile);

    const ednRouting = replSession.getRoutingInfo();
    testUtil.log(suiteName, '.edn routing with secondary cljc target:', ednRouting);

    assert.strictEqual(ednRouting?.sessionKey, 'clj', '.edn should route to clj');
    assert.strictEqual(
      ednRouting?.reason.type,
      'glob-match',
      '.edn should route via glob-match, not cljc preference'
    );
  });

  test('Files outside project root still respect cljc target (.cljc)', async function () {
    testUtil.log(suiteName, 'Testing: .cljc file outside project respects cljc target');

    await testUtil.openFile(outsideCljcFile);

    const routingInfo = replSession.getRoutingInfo();
    testUtil.log(suiteName, 'Routing for outside .cljc file:', routingInfo);

    // Files outside the connected project don't match any globs,
    // but cljc target preference is still applied
    assert.strictEqual(
      routingInfo?.reason.type,
      'cljc-within-connection',
      '.cljc file outside project should use cljc-within-connection routing'
    );
    assert.strictEqual(
      routingInfo?.sessionKey,
      'clj',
      '.cljc file outside project should route to clj (primary)'
    );

    // Toggle and verify it changes
    await vscode.commands.executeCommand('calva.toggleCLJCSession');
    await waitForRouting('cljs', 'cljc-within-connection');

    const afterToggleRouting = replSession.getRoutingInfo();
    assert.strictEqual(
      afterToggleRouting?.sessionKey,
      'cljs',
      'After toggle, outside .cljc should route to cljs'
    );
  });

  test('Files outside project root still respect cljc target (.fiddle)', async function () {
    testUtil.log(suiteName, 'Testing: .fiddle file outside project respects cljc target');

    await testUtil.openFile(outsideFiddleFile);

    const routingInfo = replSession.getRoutingInfo();
    testUtil.log(suiteName, 'Routing for outside .fiddle file:', routingInfo);

    // Files outside the connected project don't match any globs,
    // but cljc target preference is still applied
    assert.strictEqual(
      routingInfo?.reason.type,
      'cljc-within-connection',
      '.fiddle file outside project should use cljc-within-connection routing'
    );
    assert.strictEqual(
      routingInfo?.sessionKey,
      'clj',
      '.fiddle file outside project should route to clj (primary)'
    );

    // Toggle and verify it changes
    await vscode.commands.executeCommand('calva.toggleCLJCSession');
    await waitForRouting('cljs', 'cljc-within-connection');

    const afterToggleRouting = replSession.getRoutingInfo();
    assert.strictEqual(
      afterToggleRouting?.sessionKey,
      'cljs',
      'After toggle, outside .fiddle should route to cljs'
    );
  });

  async function jackInToClojureScriptProject(): Promise<void> {
    // Open a file in the project so VS Code has context
    await testUtil.openFile(cljsFile);
    testUtil.log(suiteName, `Opened file for jack-in: ${cljsFile}`);

    // Pass the full connect sequence object directly to bypass QuickPicks
    // and avoid modifying workspace settings
    await vscode.commands.executeCommand('calva.jackIn', {
      connectSequence: {
        name: 'cljc-routing-test-cljs-node',
        projectType: 'deps.edn',
        cljsType: 'ClojureScript built-in for node',
        // Absolute path to project root
        projectRootPath: [projectDir],
      },
      disableAutoSelect: true,
    });

    const client = await testUtil.waitForNewClient(suiteName);
    await testUtil.waitForSessionsReady(suiteName, client.key, ['clj', 'cljs']);
    testUtil.log(suiteName, 'Jack-in complete');
  }
});
