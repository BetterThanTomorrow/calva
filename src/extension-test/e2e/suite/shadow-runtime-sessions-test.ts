import * as assert from 'assert';
import * as Mocha from 'mocha';
import * as sessionRegistry from '../../../nrepl/session-registry';
import * as clientRegistry from '../../../nrepl/client-registry';
import * as replApi from '../../../api/repl-v1';
import * as cljsLib from '../../../../out/cljs-lib/cljs-lib';
import type * as nrepl from '../../../nrepl';
import * as testUtil from './util';
import * as shadowCljsRuntime from '../../../shadow-cljs-runtime';
import * as runtimeSessions from '../../../shadow-cljs-runtime-sessions';

const { describe, before, beforeEach, afterEach, it } = Mocha;

const mockShadowRuntimes = [
  {
    runtimeId: 42,
    description: 'Mock Browser Tab',
    buildId: ':app',
    host: 'localhost',
    workerId: 1,
    sinceInst: 12345678,
    sinceDescription: 'some time',
  },
  {
    runtimeId: 43,
    description: 'Mock Node Process',
    buildId: ':node',
    host: 'localhost',
    workerId: 0,
    sinceInst: 12345688,
    sinceDescription: 'some other time',
  },
];

type RuntimeEval = (code: string, ns: string, opts: any) => any;

/**
 * A session that the clj session's `clone` returns. It answers the
 * `shadow.cljs.devtools.api/repl` call that sets it up, recording it in `replCalls`, and runs
 * `runtimeEval` for everything else.
 */
const createRuntimeSession = (replCalls: string[], runtimeEval: RuntimeEval) => {
  const closeHandlers: (() => void)[] = [];
  return {
    replType: 'cljs',
    sessionId: 'shadow-runtime-sessions/runtime-session-id',
    eval: (code: string, ns: string, opts: any) => {
      if (code.startsWith('(shadow.cljs.devtools.api/repl ')) {
        replCalls.push(code);
        return { value: Promise.resolve('[:selected :node]') };
      }
      return runtimeEval(code, ns, opts);
    },
    stacktrace: () => Promise.resolve(undefined),
    addOnCloseHandler: (fn: () => void) => closeHandlers.push(fn),
    close: () => closeHandlers.forEach((fn) => fn()),
  } as unknown as nrepl.NReplSession;
};

const createCljsSession = (clientKey: string) =>
  ({
    replType: 'cljs',
    sessionId: 'shadow-runtime-sessions/cljs-session-id',
    client: { clientKey },
    eval: (_code: string, ns: string) => ({
      value: Promise.resolve('cljs-session'),
      ns,
      outPut: '',
      errorOutput: '',
    }),
    stacktrace: () => Promise.resolve(undefined),
  } as unknown as nrepl.NReplSession);

const registerShadowClient = (clientKey: string) =>
  clientRegistry.registerClient({ clientKey } as unknown as nrepl.NReplClient, {
    connectSequenceName: `Test Connection ${clientKey}`,
    connectionState: {
      cljsTypeName: 'shadow-cljs',
      hasBuilds: true,
      availableBuilds: [':app', ':node'],
      cljsBuild: ':app',
      shadowCljsRuntimeId: 42,
    },
  });

/**
 * Registers a shadow-cljs connection on `clientKey` with runtime 42 of `:app` selected and the cljs
 * session at `sessionKey`. Its clj session clones sessions for runtimes, which run `runtimeEval`.
 */
const setUpTargetRuntimeConnection = (
  clientKey: string,
  sessionKey: string,
  runtimeEval: RuntimeEval
) => {
  const replCalls: string[] = [];
  const remoteMessages: string[] = [];
  const runtimeSession = createRuntimeSession(replCalls, runtimeEval);
  const cljSession = {
    replType: 'clj',
    client: { clientKey },
    clone: () => Promise.resolve(runtimeSession),
    shadowCljsRemoteMessage: (data: string) => {
      remoteMessages.push(data);
      return Promise.resolve({});
    },
  } as unknown as nrepl.NReplSession;

  const originalGetShadowRuntimesAllBuilds = shadowCljsRuntime.getShadowRuntimesAllBuilds;
  (shadowCljsRuntime as any).getShadowRuntimesAllBuilds = () =>
    Promise.resolve({ activeBuilds: [':app', ':node'], runtimes: mockShadowRuntimes });
  registerShadowClient(clientKey);
  sessionRegistry.registerSession(`${sessionKey}-clj`, cljSession, {
    connectionOwnerId: clientKey,
    isSecondary: false,
    globs: ['**/*.clj'],
  });
  sessionRegistry.registerSession(sessionKey, createCljsSession(clientKey), {
    connectionOwnerId: clientKey,
    isSecondary: true,
    globs: ['**/*.cljs'],
  });

  return {
    replCalls,
    remoteMessages,
    cleanUp: () => {
      runtimeSessions.closeSessionForRuntime(clientKey, 42);
      runtimeSessions.closeSessionForRuntime(clientKey, 43);
      (shadowCljsRuntime as any).getShadowRuntimesAllBuilds = originalGetShadowRuntimesAllBuilds;
    },
  };
};

/**
 * An evaluation like `NReplEvaluation`, whose `out` and `err` collect output and pass it on to the
 * `stdout` and `stderr` of the eval options.
 */
const createRuntimeEvaluation = (ns: string, opts: any, value: Promise<string>) => {
  const evaluation = {
    value,
    ns,
    outPut: '',
    errorOutput: '',
    out: (message: string) => {
      evaluation.outPut += message;
      opts.stdout(message);
    },
    err: (message: string) => {
      evaluation.errorOutput += message;
      opts.stderr(message);
    },
  };
  return evaluation;
};

const runtimePrint = (clientKey: string, from: number, stream: string, text: string) =>
  shadowCljsRuntime.handleShadowRemoteMessage(
    { data: `{:op :runtime-print :stream :${stream} :text "${text}" :from ${from}}` },
    clientKey
  );

describe('Shadow runtime sessions suite', () => {
  let initialConnectionState: boolean | undefined;

  before(() => {
    initialConnectionState = cljsLib.getStateValue('connected');
  });

  beforeEach(() => {
    sessionRegistry._testUtility_registeredSessions.clear();
    clientRegistry._testUtility_registeredClients.clear();
    cljsLib.setStateValue('connected', true);
  });

  afterEach(() => {
    sessionRegistry._testUtility_registeredSessions.clear();
    clientRegistry._testUtility_registeredClients.clear();
    cljsLib.setStateValue('connected', initialConnectionState);
  });

  it('evaluates with targetRuntimeId in a session for that runtime', async () => {
    const clientKey = 'test-client-target-runtime-build';
    const sessionKey = 'shadow-runtime-sessions/target-runtime-build';
    const code = '(inc 1)';
    const who = 'e2e-test-target-runtime-build';
    const events: replApi.OutputMessage[] = [];
    const evaluatedInRuntimeSession: string[] = [];
    const connection = setUpTargetRuntimeConnection(clientKey, sessionKey, (evalCode, ns, opts) => {
      evaluatedInRuntimeSession.push(evalCode);
      return createRuntimeEvaluation(ns, opts, Promise.resolve('runtime-session'));
    });
    const subscription = replApi.onOutputLogged((message) => events.push(message));

    try {
      const res = await replApi.evaluate(code, {
        sessionKey,
        ns: 'user',
        who,
        targetRuntimeId: 43,
      });

      assert.strictEqual(res.result, 'runtime-session', 'The cljs session is not used');
      assert.deepStrictEqual(evaluatedInRuntimeSession, [code]);
      assert.deepStrictEqual(connection.replCalls, [
        '(shadow.cljs.devtools.api/repl :node {:runtime-id 43})',
      ]);
      assert.deepStrictEqual(connection.remoteMessages, ['{:op :runtime-print-sub :to 43}']);
      assert.strictEqual(res.shadowBuild, ':node');
      assert.strictEqual(res.shadowRuntimeId, 43);

      const labeled = events.filter((message) =>
        ['evaluatedCode', 'evaluationResults'].includes(message.category)
      );
      assert.strictEqual(labeled.length, 2);
      assert.ok(
        labeled.every(
          (message) => message.shadowBuild === ':node' && message.shadowRuntimeId === 43
        ),
        'Output is labeled with the targeted build and runtime'
      );

      await replApi.evaluate(code, { sessionKey, ns: 'user', who, targetRuntimeId: 43 });
      assert.strictEqual(connection.replCalls.length, 1, 'The session for the runtime is reused');

      const selected = await replApi.evaluate(code, {
        sessionKey,
        ns: 'user',
        who,
        targetRuntimeId: 42,
      });
      assert.strictEqual(
        selected.result,
        'runtime-session',
        'The selected runtime is targeted too'
      );
      assert.strictEqual(
        connection.replCalls[1],
        '(shadow.cljs.devtools.api/repl :app {:runtime-id 42})'
      );

      const untargeted = await replApi.evaluate(code, { sessionKey, ns: 'user', who });
      assert.strictEqual(
        untargeted.result,
        'cljs-session',
        'Without a target the cljs session is used'
      );

      await assert.rejects(
        replApi.evaluate(code, { sessionKey, ns: 'user', who, targetRuntimeId: 99 }),
        /No shadow-cljs runtime with id 99/
      );
    } finally {
      subscription.dispose();
      connection.cleanUp();
    }
  });

  it('sends prints from the targeted runtime to its evaluation, and later prints to the output', async () => {
    const clientKey = 'test-client-target-runtime-prints';
    const sessionKey = 'shadow-runtime-sessions/target-runtime-prints';
    const events: replApi.OutputMessage[] = [];
    const connection = setUpTargetRuntimeConnection(clientKey, sessionKey, (_code, ns, opts) => {
      let resolveValue: (value: string) => void;
      const evaluation = createRuntimeEvaluation(
        ns,
        opts,
        new Promise<string>((resolve) => (resolveValue = resolve))
      );
      void (async () => {
        // Prints arrive from the socket, after the eval call has returned
        await new Promise((resolve) => setTimeout(resolve, 0));
        await runtimePrint(clientKey, 43, 'stdout', 'printed during');
        await runtimePrint(clientKey, 43, 'stderr', 'error during');
        resolveValue(':done');
      })();
      return evaluation;
    });
    const subscription = replApi.onOutputLogged((message) => events.push(message));

    try {
      const res = await replApi.evaluate('(println "printed during")', {
        sessionKey,
        ns: 'cljs.user',
        targetRuntimeId: 43,
      });

      assert.strictEqual(res.result, ':done');
      assert.strictEqual(res.output, 'printed during', 'Prints during the eval are its stdout');
      assert.strictEqual(res.errorOutput, 'error during', 'Error prints are its stderr');

      await runtimePrint(clientKey, 43, 'stdout', 'printed after');
      await runtimePrint(clientKey, 42, 'stdout', 'printed by the selected runtime');

      const after = events.filter((message) => message.text.includes('printed after'));
      assert.strictEqual(after.length, 1, 'A print after the eval goes to the output');
      assert.strictEqual(after[0].category, 'otherOutput');
      assert.strictEqual(after[0].shadowRuntimeId, 43);
      assert.strictEqual(after[0].shadowBuild, ':node');
      assert.ok(
        !events.some((message) => message.text.includes('printed by the selected runtime')),
        'Prints from the selected runtime outside a tracked eval are skipped'
      );
    } finally {
      subscription.dispose();
      connection.cleanUp();
    }
  });

  it('sends prints to the running evaluation, not to one waiting behind it', async () => {
    const clientKey = 'test-client-target-runtime-queued';
    const sessionKey = 'shadow-runtime-sessions/target-runtime-queued';
    const finish: ((value: string) => void)[] = [];
    const connection = setUpTargetRuntimeConnection(clientKey, sessionKey, (_code, ns, opts) =>
      createRuntimeEvaluation(ns, opts, new Promise<string>((resolve) => finish.push(resolve)))
    );

    try {
      const first = replApi.evaluate('(println "first")', {
        sessionKey,
        ns: 'cljs.user',
        targetRuntimeId: 43,
      });
      const second = replApi.evaluate('(println "second")', {
        sessionKey,
        ns: 'cljs.user',
        targetRuntimeId: 43,
      });
      await testUtil.waitForCondition(() => finish.length === 2);

      await runtimePrint(clientKey, 43, 'stdout', 'first');
      finish[0]('nil');
      await first;
      await runtimePrint(clientKey, 43, 'stdout', 'second');
      finish[1]('nil');

      assert.strictEqual((await first).output, 'first');
      assert.strictEqual((await second).output, 'second');
    } finally {
      connection.cleanUp();
    }
  });
});
