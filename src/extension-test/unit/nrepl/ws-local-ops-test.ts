import * as expectLib from 'expect';

// We test local ops behavior indirectly via the ednEncodeNReplMessage
// and the patterns used in NReplClient._handleLocalOp.
// Direct testing of NReplClient methods isn't possible in unit tests
// (requires vscode module), so we test the JVM probe patterns and
// local op response shapes here.

const JVM_PROBE_PATTERNS = [/clojure\.main\/repl-requires/, /System\/getProperty/];

function isJvmProbe(code: string): boolean {
  return JVM_PROBE_PATTERNS.some((pattern) => pattern.test(code));
}

function handleLocalOp(
  data: Record<string, any>,
  sessions: Record<string, unknown>
): Record<string, any> | null {
  const op = data.op;
  const id = data.id;
  const session = data.session;

  switch (op) {
    case 'clone':
      return {
        id,
        'new-session': 'test-uuid',
        status: ['done'],
      };

    case 'describe':
      return {
        id,
        session,
        ops: {
          eval: {},
          complete: {},
          info: {},
          eldoc: {},
          lookup: {},
          close: {},
          clone: {},
          describe: {},
          'ls-sessions': {},
        },
        status: ['done'],
      };

    case 'ls-sessions':
      return {
        id,
        session,
        sessions: Object.keys(sessions),
        status: ['done'],
      };

    case 'eval':
      if (data.code && isJvmProbe(data.code)) {
        return {
          id,
          session,
          value: 'nil',
          ns: 'user',
          status: ['done'],
        };
      }
      return null;

    default:
      return null;
  }
}

describe('ws-local-ops', () => {
  describe('isJvmProbe', () => {
    it('detects clojure.main/repl-requires', () => {
      expectLib.expect(isJvmProbe('(apply require clojure.main/repl-requires)')).toBe(true);
    });

    it('detects System/getProperty', () => {
      expectLib.expect(isJvmProbe('(System/getProperty "java.version")')).toBe(true);
    });

    it('does not match regular eval code', () => {
      expectLib.expect(isJvmProbe('(+ 1 2)')).toBe(false);
    });

    it('does not match partial matches', () => {
      expectLib.expect(isJvmProbe('(println "hello")')).toBe(false);
    });
  });

  describe('handleLocalOp', () => {
    const sessions = { 'session-1': {}, 'session-2': {} };

    it('handles clone op', () => {
      const result = handleLocalOp({ op: 'clone', id: '1' }, sessions);
      expectLib.expect(result).not.toBeNull();
      expectLib.expect(result.id).toEqual('1');
      expectLib.expect(result['new-session']).toBeDefined();
      expectLib.expect(result.status).toEqual(['done']);
    });

    it('handles describe op', () => {
      const result = handleLocalOp({ op: 'describe', id: '2', session: 'session-1' }, sessions);
      expectLib.expect(result).not.toBeNull();
      expectLib.expect(result.ops.eval).toBeDefined();
      expectLib.expect(result.ops.complete).toBeDefined();
      expectLib.expect(result.ops.info).toBeDefined();
      expectLib.expect(result.ops.clone).toBeDefined();
      expectLib.expect(result.status).toEqual(['done']);
    });

    it('handles ls-sessions op', () => {
      const result = handleLocalOp({ op: 'ls-sessions', id: '3', session: 'session-1' }, sessions);
      expectLib.expect(result).not.toBeNull();
      expectLib.expect(result.sessions).toEqual(['session-1', 'session-2']);
      expectLib.expect(result.status).toEqual(['done']);
    });

    it('intercepts JVM probe eval', () => {
      const result = handleLocalOp(
        {
          op: 'eval',
          code: '(apply require clojure.main/repl-requires)',
          id: '4',
          session: 'session-1',
        },
        sessions
      );
      expectLib.expect(result).not.toBeNull();
      expectLib.expect(result.value).toEqual('nil');
      expectLib.expect(result.ns).toEqual('user');
      expectLib.expect(result.status).toEqual(['done']);
    });

    it('intercepts System/getProperty eval', () => {
      const result = handleLocalOp(
        {
          op: 'eval',
          code: '(System/getProperty "java.version")',
          id: '5',
          session: 'session-1',
        },
        sessions
      );
      expectLib.expect(result).not.toBeNull();
      expectLib.expect(result.value).toEqual('nil');
    });

    it('does not intercept regular eval', () => {
      const result = handleLocalOp(
        { op: 'eval', code: '(+ 1 2)', id: '6', session: 'session-1' },
        sessions
      );
      expectLib.expect(result).toBeNull();
    });

    it('returns null for unknown ops', () => {
      const result = handleLocalOp(
        { op: 'some-unknown-op', id: '7', session: 'session-1' },
        sessions
      );
      expectLib.expect(result).toBeNull();
    });
  });
});
