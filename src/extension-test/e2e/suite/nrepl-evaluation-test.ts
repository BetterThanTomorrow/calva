import * as assert from 'assert';
import * as nrepl from '../../../nrepl';

type Written = { op: string; id?: string; 'interrupt-id'?: string };

function sessionWritingTo(written: Written[]) {
  let id = 0;
  const client = {
    sessions: {},
    describe: { ops: { eval: {}, interrupt: {}, close: {} } },
    get nextId() {
      return `${++id}`;
    },
    write: (msg: Written) => written.push(msg),
  };
  return new nrepl.NReplSession('nrepl-evaluation-test', client as unknown as nrepl.NReplClient);
}

function rejection(promise: Promise<unknown>) {
  return promise.then(
    () => undefined,
    (reason) => reason
  );
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
});
