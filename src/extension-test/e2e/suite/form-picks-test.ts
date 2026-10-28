import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import * as testUtil from './util';
import * as ranges from '../../../api/ranges';
import * as getText from '../../../util/get-text';
import * as sessionRegistry from '../../../nrepl/session-registry';
import * as sessionRouting from '../../../nrepl/session-routing';
import * as replWindow from '../../../repl-window/repl-window-doc';
import * as cljsLib from '../../../../out/cljs-lib/cljs-lib';
import type * as nrepl from '../../../nrepl';

const formPicksFile = path.join(testUtil.testDataDir, 'form_picks.clj');

// In `form_picks.clj`, right after `(inc x)` in `(let [y (inc x)]`
const afterInc = new vscode.Position(3, 17);
// In `{:a [1 2] :b (str y)}`, right after `(str y)`
const afterStr = new vscode.Position(4, 24);
const defn = '(defn pick-me [x]\n  (let [y (inc x)]\n    {:a [1 2] :b (str y)}))';

const textOf = ([, text]: getText.SelectionAndText | [vscode.Range, string]) => text;

suite('Form picks', () => {
  let document: vscode.TextDocument;

  suiteSetup(async () => {
    document = await vscode.workspace.openTextDocument(formPicksFile);
  });

  test('the ranges API picks forms around a position', () => {
    assert.strictEqual(textOf(ranges.currentForm(document, afterInc)), '(inc x)');
    assert.strictEqual(textOf(ranges.currentEnclosingForm(document, afterInc)), '[y (inc x)]');
    assert.strictEqual(textOf(ranges.currentTopLevelForm(document, afterInc)), defn);
    assert.strictEqual(textOf(ranges.currentFunction(document, afterInc)), 'let');
    assert.strictEqual(textOf(ranges.currentTopLevelDef(document, afterInc)), 'pick-me');
  });

  test('custom REPL commands and hover snippets get the forms at a position, and the function, head and tail at the selection', async () => {
    const editor = await vscode.window.showTextDocument(document);
    const inStr = new vscode.Position(4, 23);
    editor.selections = [new vscode.Selection(inStr, inStr)];
    const context = getText.currentClojureContext(document, afterInc);
    assert.deepStrictEqual(
      Object.fromEntries(Object.entries(context).map(([name, picked]) => [name, textOf(picked)])),
      {
        currentForm: '(inc x)',
        currentPair: 'y (inc x)',
        enclosingForm: '[y (inc x)]',
        topLevelForm: defn,
        currentFn: 'str',
        topLevelDefinedForm: 'pick-me',
        topLevelFn: 'defn',
        head: 'str y',
        tail: '',
      }
    );
    assert.strictEqual(textOf(getText.currentPairText(document, afterStr)), ':b (str y)');
  });

  suite('Evaluating from a file', () => {
    const sessionKey = 'form-picks-test';
    const evaluated: string[] = [];
    let connectedBefore: boolean;
    let replWindowBefore: { session: nrepl.NReplSession; sessionType: string; ns: string };

    suiteSetup(() => {
      connectedBefore = cljsLib.getStateValue('connected');
      replWindowBefore = {
        session: replWindow.getSession(),
        sessionType: replWindow.getSessionType(),
        ns: replWindow.getNs(),
      };
      const session = {
        replType: 'clj',
        sessionId: 'form-picks-test-session',
        _calvaSessionMetadata: { key: sessionKey },
        eval: (code: string, ns: string) => {
          evaluated.push(code);
          return { value: Promise.resolve('nil'), ns, outPut: '', errorOutput: '' };
        },
        evaluateInNs: () => Promise.resolve(),
        stacktrace: () => Promise.resolve(undefined),
      } as unknown as nrepl.NReplSession;
      sessionRegistry.registerSession(sessionKey, session, { globs: ['**/form_picks.clj'] });
      sessionRouting.pinSession(sessionKey);
      replWindow.setSession(session, 'form-picks', sessionKey);
      cljsLib.setStateValue('connected', true);
    });

    suiteTeardown(async () => {
      sessionRouting.enableAutoRouting();
      sessionRegistry.unregisterSession(sessionKey);
      replWindow.setSession(
        replWindowBefore.session,
        replWindowBefore.ns,
        replWindowBefore.sessionType
      );
      cljsLib.setStateValue('connected', connectedBefore);
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    });

    const evaluating = async (
      command: string,
      selection: vscode.Selection = new vscode.Selection(afterInc, afterInc)
    ) => {
      const editor = await vscode.window.showTextDocument(document);
      editor.selections = [selection];
      evaluated.length = 0;
      await vscode.commands.executeCommand(command);
      return testUtil.waitForValue(
        () => evaluated[0],
        4000,
        20,
        `Timed out waiting for ${command} to evaluate`
      );
    };

    test('each evaluation command sends the form it picks', async () => {
      assert.strictEqual(await evaluating('calva.evaluateSelection'), '(inc x)');
      assert.strictEqual(await evaluating('calva.evaluateEnclosingForm'), '[y (inc x)]');
      assert.strictEqual(await evaluating('calva.evaluateCurrentTopLevelForm'), defn);
      assert.strictEqual(await evaluating('calva.evaluateToCursor'), '[y (inc x)]');
      assert.strictEqual(
        await evaluating('calva.evaluateTopLevelFormToCursor'),
        '(defn pick-me [x]\n  (let [y (inc x)]))'
      );
      assert.strictEqual(
        await evaluating('calva.evaluateStartOfFileToCursor'),
        '(ns form-picks)\n\n(defn pick-me [x]\n  (let [y (inc x)]))'
      );
      assert.strictEqual(
        await evaluating(
          'calva.evaluateSelectionToSelectionEnd',
          new vscode.Selection(new vscode.Position(3, 10), afterInc)
        ),
        '(inc x)',
        'With a selection, evaluating to the cursor sends the selection with the brackets it needs'
      );
      assert.strictEqual(
        await evaluating(
          'calva.evaluateSelection',
          new vscode.Selection(new vscode.Position(3, 11), new vscode.Position(3, 14))
        ),
        'inc'
      );
    });
  });
});
