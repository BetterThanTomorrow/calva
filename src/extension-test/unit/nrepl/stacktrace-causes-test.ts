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

  it('heads a cause with its class and message, or says there is no message', () => {
    expectLib
      .expect(cider.causeHeading(rootCause as unknown as cider.StacktraceCause))
      .toBe('java.lang.NumberFormatException: For input string: "abc"');
    expectLib
      .expect(
        cider.causeHeading({ ...outerCause, message: [] } as unknown as cider.StacktraceCause)
      )
      .toBe('clojure.lang.ExceptionInfo: No message');
  });

  it('writes a frame as its var, or its name, with file and line', () => {
    expectLib
      .expect(
        cider.frameLine({
          name: 'myproj.core$start_BANG_/invokeStatic',
          var: 'myproj.core/start!',
          file: 'core.clj',
          line: 16,
        } as cider.StacktraceFrame)
      )
      .toBe('myproj.core/start! (core.clj:16)');
    expectLib
      .expect(
        cider.frameLine({
          name: 'java.lang.Integer/parseInt',
          file: 'Integer.java',
          line: 662,
        } as cider.StacktraceFrame)
      )
      .toBe('java.lang.Integer/parseInt (Integer.java:662)');
  });

  it('writes every cause with all its frames, inner causes after Caused by', () => {
    const frame = (name: string, flags: string[]) => ({ name, file: 'f.clj', line: 1, flags });
    const causes = [
      { ...outerCause, stacktrace: [frame('a/b', ['project']), frame('a/b', ['dup', 'tooling'])] },
      { ...rootCause, stacktrace: [frame('c/d', ['java'])] },
    ] as unknown as cider.StacktraceCause[];
    expectLib
      .expect(cider.stacktraceText(causes))
      .toBe(
        [
          'clojure.lang.ExceptionInfo: Could not start',
          '  a/b (f.clj:1)',
          '  a/b (f.clj:1)',
          'Caused by: java.lang.NumberFormatException: For input string: "abc"',
          '  c/d (f.clj:1)',
        ].join('\n')
      );
    expectLib.expect(cider.stacktraceText([])).toBe('');
  });

  it('tells causes with frames from those without, as for ClojureScript', () => {
    const frameless = { ...outerCause, stacktrace: [] } as unknown as cider.StacktraceCause;
    expectLib
      .expect(cider.hasFrames([frameless, rootCause] as unknown as cider.StacktraceCause[]))
      .toBe(true);
    expectLib.expect(cider.hasFrames([frameless])).toBe(false);
    expectLib.expect(cider.hasFrames([])).toBe(false);
    expectLib.expect(cider.hasFrames(undefined)).toBe(false);
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
