import * as expectLib from 'expect';
import * as cider from '../../../nrepl/cider';

const session = 'b5eaaa14';

// Shaped like cider-nrepl's analyze-last-stacktrace reply in calva-research's runtime-chain payload
const outerCause = {
  class: 'clojure.lang.ExceptionInfo',
  data: '{:service :web}',
  id: '7',
  location: {},
  message: 'Could not start',
  phase: [],
  session,
  stacktrace: [
    { name: 'myproj.core$start_BANG_/invokeStatic', line: 16, flags: ['project', 'clj'] },
  ],
};
const rootCause = {
  class: 'java.lang.NumberFormatException',
  id: '7',
  message: 'For input string: "abc"',
  phase: [],
  session,
  stacktrace: [{ name: 'java.lang.Integer/parseInt', line: 662, flags: ['java'] }],
};

function feed(messages: object[]) {
  let resolved: unknown;
  let rejected: unknown;
  const handler = cider.stacktraceCausesHandler(
    (causes) => (resolved = causes),
    (reason) => (rejected = reason)
  );
  const handled = messages.map(handler);
  return { resolved, rejected, handled };
}

describe('stacktraceCausesHandler', () => {
  it('collects every cause, outermost first, and resolves with them on done', () => {
    const { resolved, handled } = feed([
      { id: '7', 'repl-type': 'clj', session, status: ['state'] },
      outerCause,
      rootCause,
      { id: '7', session, status: ['done'] },
    ]);
    expectLib.expect(resolved).toEqual([outerCause, rootCause]);
    expectLib.expect(handled).toEqual([false, false, false, true]);
  });

  it('resolves with no causes when there is no error', () => {
    const { resolved } = feed([
      { id: '7', session, status: ['no-error'] },
      { id: '7', session, status: ['done'] },
    ]);
    expectLib.expect(resolved).toEqual([]);
  });

  it('gives the outermost cause frames, and none when there are no causes', () => {
    expectLib
      .expect(
        cider.outermostCauseFrames([outerCause, rootCause] as unknown as cider.StacktraceCause[])
      )
      .toBe(outerCause.stacktrace);
    expectLib.expect(cider.outermostCauseFrames([])).toBeUndefined();
    expectLib.expect(cider.outermostCauseFrames(undefined)).toBeUndefined();
  });

  it('rejects when the server does not know the op', () => {
    const { resolved, rejected, handled } = feed([
      { id: '7', op: 'analyze-last-stacktrace', status: ['unknown-op', 'done'] },
    ]);
    expectLib.expect(resolved).toBeUndefined();
    expectLib.expect(rejected).toBeDefined();
    expectLib.expect(handled).toEqual([true]);
  });
});
