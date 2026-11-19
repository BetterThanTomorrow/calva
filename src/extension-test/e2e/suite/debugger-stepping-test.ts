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

async function waitForStop(previous?: StopLocation): Promise<StopLocation> {
  return testUtil.waitForValue(
    async () => {
      const stop = await currentStop();
      const moved = stop && (stop.line !== previous?.line || stop.column !== previous?.column);
      return moved ? stop : undefined;
    },
    10_000,
    100,
    `Timed out waiting for a debugger stop after ${JSON.stringify(previous ?? 'start')}`
  );
}

suite(suiteName, () => {
  const jackInHarness = new testUtil.JackInHarness(suiteName);

  mocha.before(async function () {
    this.timeout(180_000);
    testUtil.showMessage(suiteName, 'suite starting!');
    await testUtil.ensureOutputDir(testUtil.testDataDir);
    await jackInHarness.disconnectAllClients();
    await jackInHarness.jackInWithConnectSequence(testFilePath, connectSequence);
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

    const firstStop = await waitForStop();
    assert.deepStrictEqual(firstStop, { line: 4, column: 17 }, 'First stop');

    await sendToDebugAdapter('next');
    const secondStop = await waitForStop(firstStop);
    assert.deepStrictEqual(secondStop, { line: 4, column: 18 }, 'Stop after the first Step over');

    await sendToDebugAdapter('next');
    const thirdStop = await waitForStop(secondStop);
    assert.deepStrictEqual(thirdStop, { line: 5, column: 9 }, 'Stop after the second Step over');

    await sendToDebugAdapter('continue');
    assert.strictEqual(await result, '4', 'The call finishes with its value');
    await testUtil.waitForCondition(
      () => !calvaDebugSession(),
      10_000,
      50,
      'Timed out waiting for the debug session to end'
    );
  });
});
