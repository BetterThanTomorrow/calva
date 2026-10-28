import * as assert from 'assert';
import * as evaluate from '../../../evaluate';
import * as nrepl from '../../../nrepl';
import * as replWindow from '../../../repl-window/repl-window-doc';

type Written = { op: string; id?: string; 'interrupt-id'?: string };

function sessionWriting(write: (msg: Written) => void) {
  let id = 0;
  const client = {
    sessions: {},
    describe: { ops: { eval: {}, interrupt: {}, close: {} } },
    get nextId() {
      return `${++id}`;
    },
    write,
  };
  return new nrepl.NReplSession('nrepl-evaluation-test', client as unknown as nrepl.NReplClient);
}

function sessionWritingTo(written: Written[]) {
  return sessionWriting((msg) => written.push(msg));
}

function rejection(promise: Promise<unknown>) {
  return promise.then(
    () => undefined,
    (reason) => reason
  );
}

function interruptIds(written: Written[]) {
  return written.filter(({ op }) => op === 'interrupt').map((msg) => msg['interrupt-id']);
}

suite('NReplEvaluation interrupts', () => {
  let session: nrepl.NReplSession;
  let written: Written[];

  setup(() => {
    written = [];
    session = sessionWritingTo(written);
  });

  teardown(() => {
    session.close();
  });

  test('interrupts an evaluation that has had no reply yet', async () => {
    const evaluation = session.eval('(Thread/sleep 10000)', 'user');
    evaluation.interrupt();
    assert.strictEqual(evaluation.interrupted, true, 'The evaluation is interrupted');
    assert.deepStrictEqual(
      written.filter(({ op }) => op === 'interrupt').map((msg) => msg['interrupt-id']),
      [evaluation.id],
      'The interrupt is sent for the evaluation'
    );
    assert.strictEqual(
      await rejection(evaluation.value),
      'Evaluation was interrupted',
      'The evaluation ends as interrupted'
    );
  });

  test('interrupting all evaluations reaches one that has had no reply yet', async () => {
    const evaluation = session.eval('(Thread/sleep 10000)', 'user');
    nrepl.NReplEvaluation.interruptAll(() => undefined);
    assert.strictEqual(evaluation.interrupted, true, 'The evaluation is interrupted');
    assert.strictEqual(
      await rejection(evaluation.value),
      'Evaluation was interrupted',
      'The evaluation ends as interrupted'
    );
  });

  // nREPL 1.3 and later drop the evaluations waiting in a session when they interrupt the running
  // one, and never reply to them
  test('interrupting all evaluations also ends the evaluations waiting in the session', async () => {
    const running = session.eval('(Thread/sleep 60000)', 'user');
    const waiting = session.eval('(+ 1 2)', 'user');
    assert.strictEqual(
      nrepl.NReplEvaluation.interruptAll(() => undefined),
      2
    );
    assert.deepStrictEqual(interruptIds(written), [running.id, waiting.id]);
    assert.strictEqual(await rejection(running.value), 'Evaluation was interrupted');
    assert.strictEqual(await rejection(waiting.value), 'Evaluation was interrupted');
  });

  test('closing the session drops its evaluations', () => {
    session.eval('(Thread/sleep 60000)', 'user');
    session.close();
    assert.strictEqual(
      nrepl.NReplEvaluation.interruptAll(() => undefined),
      0,
      'No evaluation of the closed session is interrupted'
    );
    assert.deepStrictEqual(interruptIds(written), [], 'Nothing is written for the closed session');
  });

  test('an evaluation that fails to be sent rejects with the error', async () => {
    const error = new Error('The socket is closed');
    const failing = sessionWriting((msg) => {
      if (msg.op === 'eval') {
        throw error;
      }
    });
    try {
      const evaluation = failing.eval('(+ 1 2)', 'user');
      assert.strictEqual(await rejection(evaluation.value), error, 'The evaluation rejects');
      assert.strictEqual(
        nrepl.NReplEvaluation.interruptAll(() => undefined),
        0,
        'The evaluation is not running'
      );
    } finally {
      failing.close();
    }
  });
});

suite('Evaluating in a namespace, as files do', () => {
  let before: { session: nrepl.NReplSession; sessionType: string; ns: string };

  setup(() => {
    before = {
      session: replWindow.getSession(),
      sessionType: replWindow.getSessionType(),
      ns: replWindow.getNs(),
    };
  });

  teardown(() => {
    replWindow.setSession(before.session, before.ns, before.sessionType);
  });

  test('evaluates the ns form first when the REPL window namespace differs, and leaves the REPL window in the namespace the evaluation ended in', async () => {
    const nsFormsEvaluated: [string, string][] = [];
    const session = {
      _calvaSessionMetadata: { key: 'evaluating-in-a-namespace-test' },
      evaluateInNs: (nsForm: string, ns: string) => {
        nsFormsEvaluated.push([nsForm, ns]);
        return Promise.resolve();
      },
    } as unknown as nrepl.NReplSession;
    const endingIn = (ns: string) => () => Promise.resolve({ ns, value: 'nil' });
    replWindow.setSession(session, 'user');

    await evaluate.evaluateInNamespace(
      { session, ns: 'pirate.core', nsForm: '(ns pirate.core)' },
      endingIn('pirate.core')
    );
    assert.deepStrictEqual(
      nsFormsEvaluated,
      [['(ns pirate.core)', 'user']],
      'The ns form is evaluated in the REPL window namespace, which differs'
    );
    assert.strictEqual(replWindow.getNs(), 'pirate.core', 'The REPL window is in the namespace');

    await evaluate.evaluateInNamespace(
      { session, ns: 'pirate.core', nsForm: '(ns pirate.core (:require [clojure.string]))' },
      endingIn('pirate.core')
    );
    assert.strictEqual(
      nsFormsEvaluated.length,
      1,
      'The ns form is not evaluated while the REPL window has the namespace'
    );

    await evaluate.evaluateInNamespace(
      { session, ns: 'pirate.ui', nsForm: '(ns pirate.ui)' },
      endingIn('pirate.lib')
    );
    assert.deepStrictEqual(nsFormsEvaluated[1], ['(ns pirate.ui)', 'pirate.core']);
    assert.strictEqual(
      replWindow.getNs(),
      'pirate.lib',
      'The REPL window is in the namespace the evaluation ended in'
    );
  });
});
