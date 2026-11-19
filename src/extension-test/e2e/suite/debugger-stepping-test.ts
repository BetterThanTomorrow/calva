import * as assert from 'assert';
import * as mocha from 'mocha';
import * as path from 'path';
import * as vscode from 'vscode';
import * as jackIn from '../../../nrepl/jack-in';
import * as connectSequenceTypes from '../../../nrepl/connect-sequence-types';
import * as replSession from '../../../nrepl/repl-session';
import * as testUtil from './util';

const suiteName = 'Debugger Stepping';
const testFilePath = path.join(testUtil.testDataDir, 'debugger_stepping.clj');
const connectSequence: connectSequenceTypes.ReplConnectSequence = {
  projectType: connectSequenceTypes.ProjectTypes['deps.edn'],
  name: 'deps.edn',
  cljsType: connectSequenceTypes.CljsTypes.none,
  projectRootPath: [path.join(testUtil.testDataDir, '..')],
  menuSelections: { cljAliases: [] },
};

type StopLocation = { line: number; column: number };

function calvaDebugSession(): vscode.DebugSession | undefined {
  const session = vscode.debug.activeDebugSession;
  return session?.type === 'clojure' ? session : undefined;
}

async function currentStop(): Promise<StopLocation | undefined> {
  const session = calvaDebugSession();
  if (!session) {
    return undefined;
  }
  const { stackFrames } = await session.customRequest('stackTrace', { threadId: 1 });
  const frame = stackFrames?.[0];
  return frame ? { line: frame.line, column: frame.column } : undefined;
}

// The step and continue requests go straight to the debug adapter. VS Code's
// debug commands act on the focused thread, which VS Code sets some time after
// the stop, so they could arrive before it and do nothing.
async function sendToDebugAdapter(command: 'next' | 'continue'): Promise<void> {
  await calvaDebugSession().customRequest(command, { threadId: 1 });
}

async function stopOtherThan(previous?: StopLocation): Promise<StopLocation | undefined> {
  const stop = await currentStop();
  const moved = stop && (stop.line !== previous?.line || stop.column !== previous?.column);
  return moved ? stop : undefined;
}

/** Waits for the next stop of `call`, and fails at once with the call's own error if it ends first. */
async function waitForStop(call: Promise<unknown>, previous?: StopLocation): Promise<StopLocation> {
  const stopped = testUtil.waitForValue(
    () => stopOtherThan(previous),
    10_000,
    100,
    `Timed out waiting for a debugger stop after ${JSON.stringify(previous ?? 'start')}`
  );
  const ended = call.then((value) => {
    throw new Error(`The call ended with ${value} before stopping`);
  });
  stopped.catch(() => undefined);
  ended.catch(() => undefined);
  return Promise.race([stopped, ended]);
}

async function waitForDebugSessionToEnd(): Promise<void> {
  // The adapter ends the session when the evaluation's value arrives
  await testUtil.waitForCondition(
    () => !calvaDebugSession(),
    10_000,
    50,
    'Timed out waiting for the debug session to end'
  );
}

suite(suiteName, () => {
  const jackInHarness = new testUtil.JackInHarness(suiteName);

  mocha.before(async function () {
    this.timeout(180_000);
    testUtil.showMessage(suiteName, 'suite starting!');
    await testUtil.ensureOutputDir(testUtil.testDataDir);
    await jackInHarness.disconnectAllClients();
    const clientKey = await jackInHarness.jackInWithConnectSequence(testFilePath, connectSequence);
    // The sessions are registered before connect sends init-debugger, and a stop before that
    // makes cider-nrepl throw "Debugger not initialized!". Jack-in records the client when connect is done.
    await testUtil.waitForCondition(
      () => jackIn.listJackInProcesses().some((entry) => entry.clientKey === clientKey),
      30_000,
      100,
      'Timed out waiting for the jack-in connect to finish'
    );
  });

  mocha.after(async () => {
    if (calvaDebugSession()) {
      await vscode.debug.stopDebugging(calvaDebugSession());
    }
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await jackIn.calvaJackout({ force: true });
    await testUtil.waitForJackOutComplete(suiteName);
    testUtil.showMessage(suiteName, 'suite done!');
  });

  test('stepping over moves the stop each time and continuing finishes the call', async function () {
    this.timeout(60_000);
    const editor = await testUtil.openFile(testFilePath);
    await vscode.commands.executeCommand('calva.loadFile');
    editor.selection = new vscode.Selection(3, 4, 3, 4);
    await vscode.commands.executeCommand('calva.debug.instrument');

    const session = replSession.getSession(editor.document);
    const result = session.eval('(debugger-stepping/g 1)', 'user').value;
    // A failed assertion below ends the evaluation when after() quits; keep that rejection handled
    result.catch(() => undefined);

    const firstStop = await waitForStop(result);
    assert.deepStrictEqual(firstStop, { line: 4, column: 17 }, 'First stop');

    await sendToDebugAdapter('next');
    const secondStop = await waitForStop(result, firstStop);
    assert.deepStrictEqual(secondStop, { line: 4, column: 18 }, 'Stop after the first Step over');

    await sendToDebugAdapter('next');
    const thirdStop = await waitForStop(result, secondStop);
    assert.deepStrictEqual(thirdStop, { line: 5, column: 9 }, 'Stop after the second Step over');

    await sendToDebugAdapter('continue');
    assert.strictEqual(await result, '4', 'The call finishes with its value');
    await waitForDebugSessionToEnd();
  });

  test('a gutter breakpoint stops the call at its line once the form is evaluated', async function () {
    this.timeout(60_000);
    const editor = await testUtil.openFile(testFilePath);
    await vscode.commands.executeCommand('calva.loadFile');
    const breakpoint = new vscode.SourceBreakpoint(
      new vscode.Location(editor.document.uri, new vscode.Position(4, 0))
    );
    vscode.debug.addBreakpoints([breakpoint]);
    try {
      editor.selection = new vscode.Selection(2, 1, 2, 1);
      await vscode.commands.executeCommand('calva.evaluateCurrentTopLevelForm');

      const session = replSession.getSession(editor.document);
      const result = session.eval('(debugger-stepping/g 1)', 'user').value;
      result.catch(() => undefined);

      const stop = await waitForStop(result);
      assert.strictEqual(stop.line, 5, "The call stops on the breakpoint's line");
      await sendToDebugAdapter('continue');
      assert.strictEqual(await result, '4', 'The call finishes with its value');
      await waitForDebugSessionToEnd();
    } finally {
      vscode.debug.removeBreakpoints([breakpoint]);
    }
  });
});
