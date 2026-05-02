import * as assert from 'assert';
import * as mocha from 'mocha';
import * as path from 'path';
import * as vscode from 'vscode';
import * as testUtil from './util';
import * as clientRegistry from '../../../nrepl/client-registry';
import * as sessionRegistry from '../../../nrepl/session-registry';
import * as connector from '../../../connector';
import * as connectSequenceTypes from '../../../nrepl/connect-sequence-types';
import * as outputWindow from '../../../repl-window/repl-window-doc';
import * as docMirror from '../../../doc-mirror';

const WS_PORT_EVAL = 51340;
const WS_PORT_LOAD = 51341;
const SCITTLE_VERSION = '0.8.31';

suite('WebSocket nREPL Connect suite', function () {
  this.timeout(60_000);
  const suite = 'WebSocket Connect';
  let webviewPanel: vscode.WebviewPanel | undefined;

  mocha.before(() => {
    testUtil.showMessage(suite, 'suite starting!');
  });

  mocha.after(() => {
    testUtil.showMessage(suite, 'suite done!');
  });

  mocha.afterEach(async () => {
    if (webviewPanel) {
      webviewPanel.dispose();
      webviewPanel = undefined;
    }
    const clients = clientRegistry.listClients();
    for (const client of clients) {
      try {
        await connector.disconnect({ clientKey: client.key });
      } catch {
        // Ignore errors during cleanup
      }
    }
  });

  test('Connect via WebSocket and evaluate code', async function () {
    testUtil.log(suite, 'Connect via WebSocket and evaluate code');

    const projectDir = path.join(
      testUtil.testDataDir,
      '..',
      'projects',
      'scittle-replicant-tic-tac-toe'
    );

    // Open a file in the scittle project to set project root context
    const coreFile = path.join(
      projectDir,
      'resources',
      'scittle',
      'replicant_tictactoe',
      'core.cljs'
    );
    await testUtil.openFile(coreFile);
    testUtil.log(suite, 'core.cljs opened');

    const connectSequence: connectSequenceTypes.ReplConnectSequence = {
      name: 'scittle-ws-test',
      projectType: connectSequenceTypes.ProjectTypes['scittle'],
      cljsType: connectSequenceTypes.CljsTypes.none,
      webSocketPort: WS_PORT_EVAL,
      projectRootPath: [projectDir],
    };

    // Start the connection (this starts the WS server and waits for a browser)
    // We need to trigger the webview AFTER the WS server starts listening,
    // so we kick off the connect (which will block on firstConnectionPromise)
    // and then open the webview.
    const connectPromise = connector.connect(connectSequence, true);

    // Give the WS server a moment to start listening
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Open a webview panel that loads the scittle app — this is the "browser"
    webviewPanel = createScittleWebview(projectDir, WS_PORT_EVAL);
    testUtil.log(suite, 'Webview panel created, waiting for browser REPL to connect...');

    // Wait for the connection to complete
    const result = await connectPromise;
    assert.ok(result.connected, 'WebSocket connection should succeed');
    testUtil.log(suite, `Connected with clientKey: ${result.clientKey}`);

    // Verify sessions are registered
    const sessions = sessionRegistry.listSessions();
    assert.ok(sessions.length > 0, 'Should have at least one registered session');
    testUtil.log(suite, `Sessions: ${sessions.map((s) => s.key).join(', ')}`);

    // Evaluate simple arithmetic
    const session = sessionRegistry.getSession(sessions[0].key);
    assert.ok(session, 'Should be able to get session');
    const evalResult = await session.eval('(+ 1 2)', 'user').value;
    assert.strictEqual(evalResult, '3', 'Simple eval should return 3');
    testUtil.log(suite, `(+ 1 2) => ${evalResult}`);

    // Load the file first — this runs (main) which defs !store and event-handler!
    await vscode.commands.executeCommand('calva.loadFile');
    testUtil.log(suite, 'core.cljs loaded');

    // Play tic-tac-toe from the REPL — proves the app is live and interactive
    // SCI nREPL evaluates in 'user' but we can switch ns inline
    await session.eval("(in-ns 'replicant-tictactoe.core)", 'user').value;

    // Check initial game state
    const initialState = await session.eval('@!store', 'user').value;
    assert.ok(initialState.includes(':next-player'), 'Initial state should have :next-player');
    assert.ok(initialState.includes(':x'), 'First player should be :x');
    testUtil.log(suite, `Initial state: ${initialState}`);

    // X plays top-left
    await session.eval('(event-handler! {} [:tic 0 0])', 'user').value;
    const afterX = await session.eval('@!store', 'user').value;
    assert.ok(afterX.includes('[0 0] :x'), 'X should be at [0 0]');
    assert.ok(afterX.includes(':next-player :o'), 'Next player should be :o');
    testUtil.log(suite, `After X[0,0]: ${afterX}`);

    // O plays center
    await session.eval('(event-handler! {} [:tic 1 1])', 'user').value;
    const afterO = await session.eval('@!store', 'user').value;
    assert.ok(afterO.includes('[1 1] :o'), 'O should be at [1 1]');
    assert.ok(afterO.includes(':next-player :x'), 'Next player should be :x again');
    testUtil.log(suite, `After O[1,1]: ${afterO}`);

    // X plays middle-left, then O plays bottom-right, then X wins with left column
    await session.eval('(event-handler! {} [:tic 1 0])', 'user').value;
    await session.eval('(event-handler! {} [:tic 2 2])', 'user').value;
    await session.eval('(event-handler! {} [:tic 2 0])', 'user').value;
    const finalState = await session.eval('@!store', 'user').value;
    assert.ok(finalState.includes(':over? true'), 'Game should be over');
    assert.ok(finalState.includes(':player :x'), 'X should be the winner');
    testUtil.log(suite, `X wins! State: ${finalState}`);

    // Reset the game
    await session.eval('(event-handler! {} [:reset])', 'user').value;
    const resetState = await session.eval('@!store', 'user').value;
    assert.ok(!resetState.includes(':over?'), 'Reset state should not be over');
    assert.ok(!resetState.includes(':tics'), 'Reset state should not have tics');
    testUtil.log(suite, 'Game reset verified');

    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    testUtil.log(suite, 'Test complete');
  });

  test('Load file via WebSocket', async function () {
    testUtil.log(suite, 'Load file via WebSocket');

    const projectDir = path.join(
      testUtil.testDataDir,
      '..',
      'projects',
      'scittle-replicant-tic-tac-toe'
    );

    const coreFile = path.join(
      projectDir,
      'resources',
      'scittle',
      'replicant_tictactoe',
      'core.cljs'
    );
    await testUtil.openFile(coreFile);
    testUtil.log(suite, 'core.cljs opened');

    const connectSequence: connectSequenceTypes.ReplConnectSequence = {
      name: 'scittle-ws-test',
      projectType: connectSequenceTypes.ProjectTypes['scittle'],
      cljsType: connectSequenceTypes.CljsTypes.none,
      webSocketPort: WS_PORT_LOAD,
      projectRootPath: [projectDir],
    };

    const connectPromise = connector.connect(connectSequence, true);
    await new Promise((resolve) => setTimeout(resolve, 500));

    webviewPanel = createScittleWebview(projectDir, WS_PORT_LOAD);
    testUtil.log(suite, 'Webview created');

    const result = await connectPromise;
    assert.ok(result.connected, 'Should connect');

    // Wait for sessions to be fully ready
    await testUtil.waitForCondition(
      () => sessionRegistry.listSessions().length > 0,
      10_000,
      50,
      'Timed out waiting for sessions'
    );

    // Load the core.cljs file
    await vscode.commands.executeCommand('calva.loadFile');
    testUtil.log(suite, 'Load file command executed');

    // Verify eval result appears in repl output
    await testUtil.waitForCondition(
      async () => {
        const replWindowDoc = await outputWindow.openReplWindowDoc();
        const text = docMirror.getDocument(replWindowDoc).document.getText();
        return text.includes('nil');
      },
      10_000,
      50,
      'Timed out waiting for load-file result in REPL window'
    );

    testUtil.log(suite, 'Load file completed successfully');
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });
});

/**
 * Create a VS Code webview panel that loads the scittle tic-tac-toe app.
 * This acts as the "browser" that connects to the WS nREPL server.
 */
function createScittleWebview(projectDir: string, port: number): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    'scittle-ws-test',
    'Scittle WS Test',
    vscode.ViewColumn.Two,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.file(projectDir)],
    }
  );

  const resourceBase = panel.webview.asWebviewUri(
    vscode.Uri.file(path.join(projectDir, 'resources', 'scittle', 'replicant_tictactoe'))
  );

  panel.webview.html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <script>
      var SCITTLE_NREPL_WEBSOCKET_PORT = ${port};
      var SCITTLE_NREPL_WEBSOCKET_HOST = '127.0.0.1';
    </script>
    <script src="https://cdn.jsdelivr.net/npm/scittle@${SCITTLE_VERSION}/dist/scittle.js" type="application/javascript"></script>
    <script src="https://cdn.jsdelivr.net/npm/scittle@${SCITTLE_VERSION}/dist/scittle.nrepl.js" type="application/javascript"></script>
    <script src="https://cdn.jsdelivr.net/npm/scittle@${SCITTLE_VERSION}/dist/scittle.replicant.js" type="application/javascript"></script>
    <script type="application/x-scittle" src="${resourceBase}/ui.cljs"></script>
    <script type="application/x-scittle" src="${resourceBase}/game.cljs"></script>
    <script type="application/x-scittle" src="${resourceBase}/core.cljs"></script>
  </head>
  <body>
    <h1>Scittle WS Integration Test</h1>
    <div id="app"></div>
  </body>
</html>`;

  return panel;
}
