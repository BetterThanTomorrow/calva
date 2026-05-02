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

/**
 * Create a scittle webview via Joyride flare.
 * The flare handles CSP, resource URIs, and script loading correctly.
 */
function flareCode(port: number): string {
  return `
(require '[joyride.flare :as flare])
(defn project-path [p]
  (str "projects/scittle-replicant-tic-tac-toe/" p))
(flare/flare!+
  {:html [:html
          [:head
           [:script (str "var SCITTLE_NREPL_WEBSOCKET_PORT = " ${port} ";\\n                     var SCITTLE_NREPL_WEBSOCKET_HOST = '127.0.0.1';")]
           [:script {:src (project-path "resources/scittle/dist/scittle.js")
                     :type "application/javascript"}]
           [:script {:src (project-path "resources/scittle/dist/scittle.nrepl.js")
                     :type "application/javascript"}]
           [:script {:src (project-path "resources/scittle/dist/scittle.replicant.js")
                     :type "application/javascript"}]
           [:script {:type "application/x-scittle"
                     :src (project-path "resources/scittle/replicant_tictactoe/ui.cljs")}]
           [:script {:type "application/x-scittle"
                     :src (project-path "resources/scittle/replicant_tictactoe/game.cljs")}]
           [:script {:type "application/x-scittle"
                     :src (project-path "resources/scittle/replicant_tictactoe/core.cljs")}]]
          [:body
           [:div#app]]]
   :key :ws-test-${port}
   :title "WS Integration Test"})
`;
}

suite('WebSocket nREPL Connect suite', function () {
  this.timeout(60_000);
  const suite = 'WebSocket Connect';

  mocha.before(() => {
    testUtil.showMessage(suite, 'suite starting!');
  });

  mocha.after(() => {
    testUtil.showMessage(suite, 'suite done!');
  });

  mocha.afterEach(async () => {
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
    const t0 = Date.now();
    const elapsed = () => `${Date.now() - t0}ms`;
    testUtil.log(suite, 'Connect via WebSocket and evaluate code');

    const projectDir = path.join(
      testUtil.testDataDir,
      '..',
      'projects',
      'scittle-replicant-tic-tac-toe'
    );

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
    testUtil.log(suite, `[TIMING] connector.connect kicked off: ${elapsed()}`);

    // Wait for the WS server to be accepting connections
    await testUtil.waitForCondition(
      () => testUtil.canConnectToPort(WS_PORT_EVAL),
      5_000,
      20,
      `WS server not listening on port ${WS_PORT_EVAL}`
    );
    testUtil.log(suite, `[TIMING] WS server listening: ${elapsed()}`);

    // Open a webview panel via Joyride flare — this is the "browser"
    await vscode.commands.executeCommand('joyride.runCode', flareCode(WS_PORT_EVAL));
    testUtil.log(suite, `[TIMING] Flare webview created: ${elapsed()}`);

    // Wait for the connection to complete
    const result = await connectPromise;
    assert.ok(result.connected, 'WebSocket connection should succeed');
    testUtil.log(suite, `[TIMING] Connection complete: ${elapsed()}`);

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

    testUtil.log(suite, `[TIMING] Basic eval done: ${elapsed()}`);

    // Scittle's x-script processing already loaded all namespaces and called (main),
    // which defined !store and event-handler! — just switch namespace to access them.
    await session.eval("(in-ns 'replicant-tictactoe.core)", 'user').value;
    testUtil.log(suite, 'Switched to replicant-tictactoe.core');

    // Wait for !store to be available (x-script processing is async relative to WS connect)
    await testUtil.waitForCondition(
      async () => {
        try {
          const r = await session.eval("(try (eval '!store) true (catch :default _ false))", 'user')
            .value;
          return r === 'true';
        } catch {
          return false;
        }
      },
      5_000,
      20,
      '!store not defined in replicant-tictactoe.core'
    );
    testUtil.log(suite, `[TIMING] !store available: ${elapsed()}`);

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
    testUtil.log(suite, `[TIMING] Test 1 complete: ${elapsed()}`);
  });

  test('Load file via WebSocket', async function () {
    const t0 = Date.now();
    const elapsed = () => `${Date.now() - t0}ms`;
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

    // Wait for the WS server to be accepting connections
    await testUtil.waitForCondition(
      () => testUtil.canConnectToPort(WS_PORT_LOAD),
      5_000,
      20,
      `WS server not listening on port ${WS_PORT_LOAD}`
    );

    await vscode.commands.executeCommand('joyride.runCode', flareCode(WS_PORT_LOAD));
    testUtil.log(suite, `[TIMING] Webview created: ${elapsed()}`);

    const result = await connectPromise;
    assert.ok(result.connected, 'Should connect');

    // Wait for sessions to be fully ready
    await testUtil.waitForCondition(
      () => sessionRegistry.listSessions().length > 0,
      2_000,
      20,
      'Timed out waiting for sessions'
    );

    // Load the core.cljs file
    await vscode.commands.executeCommand('calva.loadFile', { path: coreFile });
    testUtil.log(suite, 'Load file command executed');

    // Verify eval result appears in repl output
    await testUtil.waitForCondition(
      async () => {
        const replWindowDoc = await outputWindow.openReplWindowDoc();
        const text = docMirror.getDocument(replWindowDoc).document.getText();
        return text.includes('nil');
      },
      2_000,
      20,
      'Timed out waiting for load-file result in REPL window'
    );

    testUtil.log(suite, `[TIMING] Test 2 complete: ${elapsed()}`);
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });
});
