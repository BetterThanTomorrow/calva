import * as assert from 'assert';
import * as evaluate from '../../../evaluate';
import * as nrepl from '../../../nrepl';
import { disabledPrettyPrinter } from '../../../printer';
import * as replWindow from '../../../repl-window/repl-window-doc';
import * as whoTracking from '../../../api/who-tracking';

type Written = { op: string; id?: string; 'interrupt-id'?: string };

function sessionWriting(write: (msg: Written) => void) {
  let id = 0;
  const client = {
    sessions: {},
    describe: { ops: { eval: {}, interrupt: {}, close: {}, 'analyze-last-stacktrace': {} } },
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
    assert.ok(!evaluation.dropped, 'An interrupted evaluation is not dropped');
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

  test('closing the session ends its evaluations', async () => {
    const evaluation = session.eval('(Thread/sleep 60000)', 'user');
    session.close();
    assert.strictEqual(
      await rejection(evaluation.value),
      'The REPL session closed before the evaluation finished',
      'The evaluation rejects'
    );
    assert.ok(!evaluation.running, 'The evaluation is not running');
    assert.ok(evaluation.dropped, 'The evaluation is dropped');
    nrepl.NReplEvaluation.interruptAll(() => undefined);
    assert.ok(!evaluation.interrupted, 'Interrupt leaves it out');
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

  test('evaluates the ns form first unless the session last evaluated in the namespace, and leaves the REPL window in the namespace the evaluation ended in', async () => {
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
      'The ns form is evaluated in the namespace the session last evaluated in, which differs'
    );
    assert.strictEqual(replWindow.getNs(), 'pirate.core', 'The REPL window is in the namespace');

    await evaluate.evaluateInNamespace(
      { session, ns: 'pirate.core', nsForm: '(ns pirate.core (:require [clojure.string]))' },
      endingIn('pirate.core')
    );
    assert.strictEqual(
      nsFormsEvaluated.length,
      1,
      'The ns form is not evaluated while the session has the namespace'
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

  test('evaluates the ns form in each session the code goes to, as after a cljc target switch', async () => {
    const nsFormsEvaluated: [string, string][] = [];
    const sessionKeyed = (key: string) =>
      ({
        _calvaSessionMetadata: { key },
        evaluateInNs: (nsForm: string) => {
          nsFormsEvaluated.push([key, nsForm]);
          return Promise.resolve();
        },
      } as unknown as nrepl.NReplSession);
    const clj = sessionKeyed('evaluating-in-a-namespace-test-clj');
    const cljs = sessionKeyed('evaluating-in-a-namespace-test-cljs');
    replWindow.setSession(clj, 'user');
    replWindow.setSession(cljs, 'cljs.user');
    const evaluateIn = (session: nrepl.NReplSession) =>
      evaluate.evaluateInNamespace(
        { session, ns: 'pirate.common', nsForm: '(ns pirate.common)' },
        () => Promise.resolve({ ns: 'pirate.common', value: 'nil' })
      );

    await evaluateIn(cljs);
    await evaluateIn(clj);
    assert.deepStrictEqual(
      nsFormsEvaluated,
      [
        ['evaluating-in-a-namespace-test-cljs', '(ns pirate.common)'],
        ['evaluating-in-a-namespace-test-clj', '(ns pirate.common)'],
      ],
      'Each session gets the ns form, though the REPL window already shows the namespace'
    );

    await evaluateIn(cljs);
    assert.strictEqual(
      nsFormsEvaluated.length,
      2,
      'A session that last evaluated in the namespace gets no ns form'
    );
  });

  test('a renamed session evaluates the ns form only when its namespace changes', async () => {
    const nsFormsEvaluated: string[] = [];
    const metadata = { key: 'evaluating-in-a-namespace-test-before-rename' };
    const session = {
      _calvaSessionMetadata: metadata,
      evaluateInNs: (nsForm: string) => {
        nsFormsEvaluated.push(nsForm);
        return Promise.resolve();
      },
    } as unknown as nrepl.NReplSession;
    replWindow.setSession(session, 'pirate.core');
    // As the REPL Sessions menu renames a session
    metadata.key = 'evaluating-in-a-namespace-test-after-rename';
    replWindow.setSession(session, 'user', metadata.key);
    const evaluateInOther = () =>
      evaluate.evaluateInNamespace(
        { session, ns: 'pirate.other', nsForm: '(ns pirate.other)' },
        () => Promise.resolve({ ns: 'pirate.other', value: 'nil' })
      );

    await evaluateInOther();
    await evaluateInOther();
    assert.deepStrictEqual(
      nsFormsEvaluated,
      ['(ns pirate.other)'],
      'The second evaluation keeps the namespace, and *1 with it'
    );
  });

  test('an evaluation whose session closes leaves the REPL window as it was, and asks the closed session for no stacktrace', async () => {
    const windowSession = {
      _calvaSessionMetadata: { key: 'evaluating-in-a-namespace-test' },
    } as unknown as nrepl.NReplSession;
    const written: Written[] = [];
    const session = sessionWritingTo(written);
    // A key of its own, so the evaluation's activity isn't recorded for the real clj session
    const sessionKey = 'nrepl-evaluation-test';
    (session as unknown as { _calvaSessionMetadata: { key: string } })._calvaSessionMetadata = {
      key: sessionKey,
    };
    // The session is in user, as a connected session is
    replWindow.setSession(session, 'user');
    replWindow.setSession(windowSession, 'user');
    try {
      const evaluating = evaluate.evaluateInNamespace(
        { session, ns: 'user', nsForm: '(ns user)' },
        () =>
          evaluate.evaluateToOutputDestinations({
            code: '(Thread/sleep 60000)',
            session,
            ns: 'user',
            filePath: 'nrepl-evaluation-test.clj',
            line: 0,
            column: 0,
            pprintOptions: disabledPrettyPrinter,
            echoDestinations: [],
          })
      );
      session.close();
      assert.deepStrictEqual(
        await evaluating,
        {
          error: 'The REPL session closed before the evaluation finished',
          dropped: true,
          ns: 'user',
        },
        'The evaluation ends as dropped'
      );
      assert.strictEqual(
        replWindow.getSession(),
        windowSession,
        'The REPL window keeps its session'
      );
      assert.deepStrictEqual(
        written.filter(({ op }) => op === 'analyze-last-stacktrace'),
        [],
        'The closed session is not asked for a stacktrace'
      );
    } finally {
      session.close();
      whoTracking.clearSessionTracking(sessionKey);
      whoTracking.clearCurrentWho(session.sessionId);
    }
  });
});
