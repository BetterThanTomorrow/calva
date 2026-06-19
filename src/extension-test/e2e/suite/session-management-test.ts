import * as assert from 'assert';
import * as Mocha from 'mocha';
import * as path from 'path';
import * as vscode from 'vscode';
import * as sessionRegistry from '../../../nrepl/session-registry';
import * as outputWindow from '../../../repl-window/repl-window-doc';
import * as connector from '../../../connector';
import * as replApi from '../../../api/repl-v1';
import * as replSession from '../../../nrepl/repl-session';
import * as evaluate from '../../../evaluate';
import * as cljsLib from '../../../../out/cljs-lib/cljs-lib';
import type * as nrepl from '../../../nrepl';
import * as testUtil from './util';
import * as sessionRouting from '../../../nrepl/session-routing';
import * as clientRegistry from '../../../nrepl/client-registry';
import * as globs from '../../../nrepl/globs';
import * as docMirror from '../../../doc-mirror';
import * as shadowCljsRuntime from '../../../shadow-cljs-runtime';

const { describe, before, beforeEach, afterEach, it } = Mocha;

const suiteName = 'Session management';
const serverSessionKey = 'session-management/server';
const uiSessionKey = 'session-management/ui';

const createSession = (replType: string, clientKey?: string): nrepl.NReplSession =>
  ({
    replType,
    client: clientKey ? { clientKey } : undefined,
  } as nrepl.NReplSession);

const createEvaluatingSession = (result: string, clientKey?: string): nrepl.NReplSession =>
  ({
    replType: 'clj',
    sessionId: 'session-management/evaluate-session-id',
    client: clientKey ? { clientKey } : undefined,
    eval: (_code: string, ns: string) => ({
      value: Promise.resolve(result),
      ns,
      outPut: '',
      errorOutput: '',
    }),
    stacktrace: () => Promise.resolve(undefined),
  } as unknown as nrepl.NReplSession);

const resetOutputWindowSession = (sessionType: string, ns: string): void => {
  outputWindow.setSession(createSession(sessionType), ns, sessionType);
};

const getReplWindowText = async (): Promise<string> => {
  const replWindowDoc = await outputWindow.openReplWindowDoc();
  return docMirror.getDocument(replWindowDoc).document.getText();
};

describe(`${suiteName} suite`, () => {
  let initialConnectionState: boolean | undefined;
  let initialCurrentSessionType: string | undefined;
  let initialOutputSessionType: string | undefined;
  let initialOutputNamespace: string | undefined;

  before(async () => {
    initialConnectionState = cljsLib.getStateValue('connected');
    initialCurrentSessionType = cljsLib.getStateValue('current-session-type');
    initialOutputSessionType = outputWindow.getSessionType();
    initialOutputNamespace = outputWindow.getNs();
    await outputWindow.initReplWindowDoc();
  });

  beforeEach(() => {
    sessionRegistry._testUtility_registeredSessions.clear();
    sessionRegistry.setClojureDocsSessionKey(null);
    cljsLib.setStateValue('connected', true);
    cljsLib.setStateValue('current-session-type', undefined);
    sessionRouting.resetRouting();
    clientRegistry._testUtility_registeredClients.clear();
    resetOutputWindowSession('clj', 'user');
  });

  afterEach(() => {
    sessionRegistry._testUtility_registeredSessions.clear();
    sessionRegistry.setClojureDocsSessionKey(null);
    cljsLib.setStateValue('connected', initialConnectionState);
    cljsLib.setStateValue('current-session-type', initialCurrentSessionType);
    sessionRouting.resetRouting();
    clientRegistry._testUtility_registeredClients.clear();
    const fallbackSessionType = initialOutputSessionType ?? 'clj';
    const fallbackNamespace = initialOutputNamespace ?? 'user';
    resetOutputWindowSession(fallbackSessionType, fallbackNamespace);
  });

  it('exposes registered sessions through the public API', () => {
    sessionRegistry.registerSession(serverSessionKey, createSession('clj'), {
      projectRoot: 'file:///server',
      globs: ['apps/server/**'],
    });
    sessionRegistry.registerSession(uiSessionKey, createSession('cljs'), {
      projectRoot: 'file:///ui',
      globs: ['apps/ui/**'],
    });

    const sessions = replApi.listSessions();
    assert.strictEqual(sessions.length, 2);
    const keys = sessions.map((s) => s.replSessionKey).sort();
    assert.deepStrictEqual(keys, [serverSessionKey, uiSessionKey]);
    const serverMeta = sessions.find((s) => s.replSessionKey === serverSessionKey);
    assert.deepStrictEqual(serverMeta.globs, ['apps/server/**']);
  });

  it('exposes registered sessions with enriched metadata through the public API', () => {
    const clientKey = 'test-client-enriched';
    const stubClient = {
      clientKey,
    } as unknown as nrepl.NReplClient;

    clientRegistry.registerClient(stubClient, {
      connectSequenceName: 'Test Connection Enriched',
      connectionState: {
        cljsTypeName: 'shadow-cljs',
        hasBuilds: true,
        availableBuilds: ['app', 'node'],
        cljsBuild: 'app',
        shadowCljsRuntimeId: 42,
      },
    });

    sessionRegistry.registerSession(uiSessionKey, createSession('cljs', clientKey), {
      connectionOwnerId: clientKey,
      isSecondary: true,
      projectRoot: 'file:///ui',
      globs: ['apps/ui/**'],
    });

    const sessions = replApi.listSessions();
    assert.strictEqual(sessions.length, 1);
    const uiMeta = sessions.find((s) => s.replSessionKey === uiSessionKey);
    assert.ok(uiMeta);
    assert.strictEqual(uiMeta.replType, 'cljs');
    assert.strictEqual(uiMeta.hasBuilds, true);
    assert.strictEqual(uiMeta.supportsRuntimes, true);
    assert.deepStrictEqual(uiMeta.availableBuilds, ['app', 'node']);
    assert.strictEqual(uiMeta.currentlyConnectedCljsBuild, 'app');
    assert.strictEqual(uiMeta.currentlyConnectedRuntimeId, 42);
  });

  it('queries active runtimes through listRuntimes()', async () => {
    const clientKey = 'test-client-runtimes';
    const mockRuntimes = [
      {
        clientId: 42,
        description: 'Mock Browser Tab',
        buildId: 'app',
        host: 'localhost',
        workerId: 1,
        sinceInst: 12345678,
        sinceDescription: 'some time',
      },
    ];

    // Mock the getShadowRuntimesForClient in shadow-cljs-runtime
    const originalGetShadowRuntimesForClient = shadowCljsRuntime.getShadowRuntimesForClient;
    (shadowCljsRuntime as any).getShadowRuntimesForClient = (key: string) => {
      assert.strictEqual(key, clientKey);
      return Promise.resolve(mockRuntimes);
    };

    const stubClient = {
      clientKey,
    } as unknown as nrepl.NReplClient;

    clientRegistry.registerClient(stubClient, {
      connectSequenceName: 'Test Connection Runtimes',
      connectionState: {
        cljsTypeName: 'shadow-cljs',
      },
    });

    sessionRegistry.registerSession(uiSessionKey, createSession('cljs', clientKey), {
      connectionOwnerId: clientKey,
      isSecondary: true,
    });

    try {
      const runtimes = await replApi.listRuntimes(uiSessionKey);
      assert.deepStrictEqual(runtimes, mockRuntimes);
    } finally {
      (shadowCljsRuntime as any).getShadowRuntimesForClient = originalGetShadowRuntimesForClient;
    }
  });

  it('getShadowRuntimesForClient uses correct query code depending on cljsBuild state', async () => {
    const clientKey = 'test-client-fallback';
    let evaluatedCode = '';

    const mockPrimarySession = {
      replType: 'clj',
      sessionId: 'primary-session-id',
      eval: (code: string, ns: string) => {
        evaluatedCode = code;
        return {
          value: Promise.resolve('[]'),
          ns,
          outPut: '',
          errorOutput: '',
        };
      },
    } as unknown as nrepl.NReplSession;

    const stubClient = {
      clientKey,
    } as unknown as nrepl.NReplClient;

    clientRegistry.registerClient(stubClient, {
      connectSequenceName: 'Test Connection Fallback',
      connectionState: {
        cljsTypeName: 'shadow-cljs',
      },
    });

    sessionRegistry.registerSession('session-management/primary-session', mockPrimarySession, {
      connectionOwnerId: clientKey,
      isSecondary: false,
    });

    // 1. Without cljsBuild, it should query active-builds
    let runtimes = await shadowCljsRuntime.getShadowRuntimesForClient(clientKey);
    assert.deepStrictEqual(runtimes, []);
    assert.ok(evaluatedCode.includes('active-builds'));

    // 2. With cljsBuild set, it should query that build specifically
    clientRegistry.setConnectionState(clientKey, { cljsBuild: 'app' });
    runtimes = await shadowCljsRuntime.getShadowRuntimesForClient(clientKey);
    assert.deepStrictEqual(runtimes, []);
    assert.strictEqual(evaluatedCode, '(shadow.cljs.devtools.api/repl-runtimes app)');

    // Cleanup
    sessionRegistry.unregisterSession('session-management/primary-session');
  });

  it('passes targetRuntimeId as runtime-id in evaluate nREPL options', async () => {
    const sessionKey = 'session-management/target-runtime-evaluate';
    const code = '(inc 1)';
    const evaluationResult = '2';
    let passedOpts: any = null;

    const mockSession = {
      replType: 'cljs',
      sessionId: 'target-runtime-session-id',
      eval: (_code: string, _ns: string, opts: any) => {
        passedOpts = opts;
        return {
          value: Promise.resolve(evaluationResult),
          ns: 'user',
          outPut: '',
          errorOutput: '',
        };
      },
      stacktrace: () => Promise.resolve(undefined),
    } as unknown as nrepl.NReplSession;

    sessionRegistry.registerSession(sessionKey, mockSession, {
      globs: ['**/*.cljs'],
    });

    try {
      await replApi.evaluate(code, {
        sessionKey,
        targetRuntimeId: 42,
      });

      assert.ok(passedOpts);
      assert.strictEqual(passedOpts['runtime-id'], 42);
    } finally {
      sessionRegistry.unregisterSession(sessionKey);
    }
  });

  it('returns workspace-relative project root paths through the API', () => {
    const absoluteProjectRoot = path.join(testUtil.testDataDir, 'projects', 'deps.edn');
    sessionRegistry.registerSession(serverSessionKey, createSession('clj'), {
      projectRoot: absoluteProjectRoot,
      globs: ['**/*.clj'],
    });

    const sessions = replApi.listSessions();
    assert.strictEqual(sessions.length, 1);
    const session = sessions[0];

    // Should return workspace-relative path, not absolute
    assert.ok(session.projectRoot);
    assert.ok(
      !path.isAbsolute(session.projectRoot),
      `Expected workspace-relative path but got absolute: ${session.projectRoot}`
    );
    assert.ok(
      session.projectRoot.includes('projects/deps.edn'),
      `Expected path to include projects/deps.edn but got: ${session.projectRoot}`
    );
  });

  it('emits evaluatedCode once regardless of the code-echo setting', async () => {
    const config = vscode.workspace.getConfiguration('calva');
    const originalDestinations = config.inspect('outputDestinations')?.globalValue;
    const originalSendCodeSetting = config.inspect('evaluationSendCodeToOutputWindow')?.globalValue;
    const sessionKey = 'session-management/evaluate';
    const code = '(inc 1)';
    const evaluationResult = '2';
    const who = 'e2e-test';
    const events: replApi.OutputMessage[] = [];

    sessionRegistry.registerSession(sessionKey, createEvaluatingSession(evaluationResult), {
      globs: ['**/*.clj'],
    });

    const subscription = replApi.onOutputLogged((message) => events.push(message));

    try {
      await config.update(
        'outputDestinations',
        {
          evalResults: 'repl-window',
          evalOutput: 'repl-window',
          otherOutput: 'repl-window',
        },
        vscode.ConfigurationTarget.Global
      );

      for (const sendCodeToOutputWindow of [false, true]) {
        events.length = 0;
        await outputWindow.clearReplWindowDoc();
        await config.update(
          'evaluationSendCodeToOutputWindow',
          sendCodeToOutputWindow,
          vscode.ConfigurationTarget.Global
        );

        await replApi.evaluate(code, {
          sessionKey,
          ns: 'user',
          who,
        });

        let lastReplText = '';
        await testUtil.waitForCondition(async () => {
          const replWindowDoc = await outputWindow.openReplWindowDoc();
          lastReplText = docMirror.getDocument(replWindowDoc).document.getText();
          return lastReplText.includes(code);
        });

        const evaluatedCodeEvents = events.filter(
          (message) => message.category === 'evaluatedCode'
        );
        assert.strictEqual(
          evaluatedCodeEvents.length,
          1,
          `Expected one evaluatedCode event when evaluationSendCodeToOutputWindow=${sendCodeToOutputWindow}`
        );
        assert.strictEqual(evaluatedCodeEvents[0].who, who);
        assert.strictEqual(evaluatedCodeEvents[0].ns, 'user');
        assert.strictEqual(evaluatedCodeEvents[0].replSessionKey, sessionKey);

        const replWindowDoc = await outputWindow.openReplWindowDoc();
        const replText = docMirror.getDocument(replWindowDoc).document.getText();
        const codeOccurrences = (replText.match(/\(inc 1\)/g) || []).length;

        assert.strictEqual(
          codeOccurrences,
          1,
          `Expected visible evaluated code once when evaluationSendCodeToOutputWindow=${sendCodeToOutputWindow}`
        );
      }
    } finally {
      subscription.dispose();
      sessionRegistry.unregisterSession(sessionKey);
      await config.update(
        'outputDestinations',
        originalDestinations,
        vscode.ConfigurationTarget.Global
      );
      await config.update(
        'evaluationSendCodeToOutputWindow',
        originalSendCodeSetting,
        vscode.ConfigurationTarget.Global
      );
      await outputWindow.clearReplWindowDoc();
    }
  });

  it('manual evaluation emits evaluatedCode once and only echoes to the REPL window when enabled', async () => {
    const config = vscode.workspace.getConfiguration('calva');
    const originalDestinations = config.inspect('outputDestinations')?.globalValue;
    const originalSendCodeSetting = config.inspect('evaluationSendCodeToOutputWindow')?.globalValue;
    const sessionKey = 'session-management/manual-evaluate';
    const code = '(inc 1)';
    const evaluationResult = '2';
    const events: replApi.OutputMessage[] = [];
    const editor = await testUtil.openFile(path.join(testUtil.testDataDir, 'test.clj'));

    sessionRegistry.registerSession(sessionKey, createEvaluatingSession(evaluationResult), {
      globs: ['**/*.clj'],
    });

    const subscription = replApi.onOutputLogged((message) => events.push(message));

    try {
      await config.update(
        'outputDestinations',
        {
          evalResults: 'repl-window',
          evalOutput: 'output-channel',
          otherOutput: 'output-channel',
        },
        vscode.ConfigurationTarget.Global
      );

      for (const sendCodeToOutputWindow of [false, true]) {
        events.length = 0;
        await outputWindow.clearReplWindowDoc();
        await config.update(
          'evaluationSendCodeToOutputWindow',
          sendCodeToOutputWindow,
          vscode.ConfigurationTarget.Global
        );

        const activeEditor = await vscode.window.showTextDocument(editor.document, {
          preview: false,
        });
        await testUtil.waitForCondition(
          () => vscode.window.activeTextEditor?.document.uri.fsPath === editor.document.uri.fsPath,
          4000,
          20,
          'Timed out waiting for the source editor to become active'
        );

        await evaluate.evaluateInCurrentEditor(activeEditor, code, sessionKey, 'user', {});

        await testUtil.waitForCondition(
          () => events.filter((message) => message.category === 'evaluatedCode').length === 1,
          4000,
          20,
          'Timed out waiting for manual evaluatedCode event'
        );

        const evaluatedCodeEvents = events.filter(
          (message) => message.category === 'evaluatedCode'
        );
        assert.strictEqual(
          evaluatedCodeEvents.length,
          1,
          `Expected one manual evaluatedCode event when evaluationSendCodeToOutputWindow=${sendCodeToOutputWindow}`
        );
        assert.strictEqual(evaluatedCodeEvents[0].who, 'ui');
        assert.strictEqual(evaluatedCodeEvents[0].ns, 'user');
        assert.strictEqual(evaluatedCodeEvents[0].replSessionKey, sessionKey);

        if (sendCodeToOutputWindow) {
          await testUtil.waitForCondition(
            async () => (await getReplWindowText()).includes(code),
            4000,
            20,
            'Timed out waiting for manual REPL-window echo'
          );
        }

        const replText = await getReplWindowText();
        const codeOccurrences = (replText.match(/\(inc 1\)/g) || []).length;

        assert.strictEqual(
          codeOccurrences,
          sendCodeToOutputWindow ? 1 : 0,
          `Unexpected REPL-window echo count when evaluationSendCodeToOutputWindow=${sendCodeToOutputWindow}`
        );
      }
    } finally {
      subscription.dispose();
      sessionRegistry.unregisterSession(sessionKey);
      await config.update(
        'outputDestinations',
        originalDestinations,
        vscode.ConfigurationTarget.Global
      );
      await config.update(
        'evaluationSendCodeToOutputWindow',
        originalSendCodeSetting,
        vscode.ConfigurationTarget.Global
      );
      await outputWindow.clearReplWindowDoc();
    }
  });

  it('manual REPL-window evaluation avoids duplicate visible code while still emitting evaluatedCode', async () => {
    const config = vscode.workspace.getConfiguration('calva');
    const originalDestinations = config.inspect('outputDestinations')?.globalValue;
    const sessionKey = 'session-management/repl-window-evaluate';
    const code = '(inc 1)';
    const evaluationResult = '2';
    const events: replApi.OutputMessage[] = [];

    sessionRegistry.registerSession(sessionKey, createEvaluatingSession(evaluationResult), {
      globs: ['**/*.clj'],
    });

    const subscription = replApi.onOutputLogged((message) => events.push(message));

    try {
      await config.update(
        'outputDestinations',
        {
          evalResults: 'output-channel',
          evalOutput: 'output-channel',
          otherOutput: 'output-channel',
        },
        vscode.ConfigurationTarget.Global
      );

      await outputWindow.clearReplWindowDoc();
      await outputWindow.revealReplWindowDoc(false);
      await testUtil.waitForCondition(
        () => outputWindow.isReplWindowDoc(vscode.window.activeTextEditor?.document),
        4000,
        20,
        'Timed out waiting for REPL window to become active'
      );

      outputWindow.appendLine(code);
      await testUtil.waitForCondition(
        async () => (await getReplWindowText()).includes(code),
        4000,
        20,
        'Timed out waiting for test code to be appended to the REPL window'
      );

      await evaluate.evaluateInOutputWindow(code, sessionKey, 'user', {
        evaluationSendCodeToOutputWindow: false,
      });

      await testUtil.waitForCondition(
        () => events.filter((message) => message.category === 'evaluatedCode').length === 1,
        4000,
        20,
        'Timed out waiting for REPL-window evaluatedCode event'
      );

      const evaluatedCodeEvents = events.filter((message) => message.category === 'evaluatedCode');
      assert.strictEqual(evaluatedCodeEvents.length, 1);
      assert.strictEqual(evaluatedCodeEvents[0].replSessionKey, sessionKey);

      const replText = await getReplWindowText();
      const codeOccurrences = (replText.match(/\(inc 1\)/g) || []).length;
      assert.strictEqual(codeOccurrences, 1, 'Expected REPL-window code to remain single-copy');
    } finally {
      subscription.dispose();
      sessionRegistry.unregisterSession(sessionKey);
      await config.update(
        'outputDestinations',
        originalDestinations,
        vscode.ConfigurationTarget.Global
      );
      await outputWindow.clearReplWindowDoc();
    }
  });

  it('toggle command cycles cljc target within a connection', () => {
    const clientKey = 'test-client';
    const stubClient = {
      clientKey,
      close: () => Promise.resolve(undefined),
      disconnect: () => undefined,
      addOnCloseHandler: () => undefined,
      removeOnCloseHandler: () => undefined,
    } as unknown as nrepl.NReplClient;

    clientRegistry.registerClient(stubClient, {
      connectSequenceName: 'Test Connection',
    });

    sessionRegistry.registerSession(serverSessionKey, createSession('clj', clientKey), {
      globs: ['**/*.clj'],
      connectionOwnerId: clientKey,
      isSecondary: false,
    });
    sessionRegistry.registerSession(uiSessionKey, createSession('cljs', clientKey), {
      globs: ['**/*.cljs'],
      connectionOwnerId: clientKey,
      isSecondary: true,
    });

    // Set initial cljc target to primary
    clientRegistry.setCljcTargetForConnection(clientKey, 'primary');
    assert.strictEqual(clientRegistry.getCljcTargetForConnection(clientKey), 'primary');

    cljsLib.setStateValue('current-session-type', serverSessionKey);

    connector.toggleCLJCSession();
    assert.strictEqual(clientRegistry.getCljcTargetForConnection(clientKey), 'secondary');

    connector.toggleCLJCSession();
    assert.strictEqual(clientRegistry.getCljcTargetForConnection(clientKey), 'primary');
  });

  it('honors session glob mappings when resolving active files', async () => {
    const cljSession = createSession('clj');
    const cljsSession = createSession('cljs');
    sessionRegistry.registerSession(serverSessionKey, cljSession, {
      globs: ['**/*.clj'],
    });
    sessionRegistry.registerSession(uiSessionKey, cljsSession, {
      globs: ['**/*.cljs'],
    });

    const testFilePath = path.join(testUtil.testDataDir, 'test.clj');
    await testUtil.openFile(testFilePath);

    const resolved = replSession.getSession();
    assert.strictEqual(resolved, cljSession);
  });

  it('marks currently routed session in API response', async () => {
    const cljSession = createSession('clj');
    const cljsSession = createSession('cljs');
    sessionRegistry.registerSession(serverSessionKey, cljSession, {
      globs: ['**/*.clj'],
    });
    sessionRegistry.registerSession(uiSessionKey, cljsSession, {
      globs: ['**/*.cljs'],
    });

    const testFilePath = path.join(testUtil.testDataDir, 'test.clj');
    await testUtil.openFile(testFilePath);

    const sessions = replApi.listSessions();
    assert.strictEqual(sessions.length, 2);

    // The clj session should be marked as current because test.clj routes to it
    const currentSession = sessions.find((s) => s.currentRoutedTarget);
    assert.ok(currentSession, 'Should have a current routed session');
    assert.strictEqual(currentSession.replSessionKey, serverSessionKey);

    // The cljs session should NOT be marked as current
    const otherSession = sessions.find((s) => s.replSessionKey === uiSessionKey);
    assert.strictEqual(otherSession.currentRoutedTarget, false);
  });

  it('prefers pinned sessions over glob routing', async () => {
    const cljSession = createSession('clj');
    const cljsSession = createSession('cljs');
    sessionRegistry.registerSession(serverSessionKey, cljSession, {
      globs: ['**/*.clj'],
    });
    sessionRegistry.registerSession(uiSessionKey, cljsSession, {
      globs: ['**/*.cljs'],
    });

    sessionRouting.pinSession(uiSessionKey);

    const testFilePath = path.join(testUtil.testDataDir, 'test.clj');
    await testUtil.openFile(testFilePath);

    const resolved = replSession.getSession();
    assert.strictEqual(resolved, cljsSession);
  });

  it('disconnect command tears down targeted clients without affecting others', async () => {
    const stubClient = {
      clientKey: 'session-management/client',
      close: () => Promise.resolve(undefined),
      disconnect: () => undefined,
      addOnCloseHandler: () => undefined,
      removeOnCloseHandler: () => undefined,
    } as unknown as nrepl.NReplClient;

    clientRegistry.registerClient(stubClient, {
      connectSequenceName: 'Test Connection',
    });

    sessionRegistry.registerSession(serverSessionKey, createSession('clj'), {
      connectionOwnerId: stubClient.clientKey,
    });

    await connector.disconnect({ clientKey: 'session-management/client' });

    assert.strictEqual(sessionRegistry.listSessions().length, 0);
    assert.strictEqual(clientRegistry.listClients().length, 0);
  });

  it('prefers more specific always-claim globs even when registered earlier', async () => {
    const generalCljs = createSession('cljs');
    const joyrideCljs = createSession('cljs');

    sessionRegistry.registerSession('general-cljs', generalCljs, {
      globs: ['**/*.cljs'],
      globSpecs: globs.buildGlobSpecsFromTiers({
        'always-claim': ['**/*.cljs'],
        'is-fallback-for': [],
      }),
    });

    sessionRegistry.registerSession('joyride', joyrideCljs, {
      globs: ['**/.joyride/**/*.cljs'],
      globSpecs: globs.buildGlobSpecsFromTiers({
        'always-claim': ['**/.joyride/**/*.cljs'],
        'is-fallback-for': [],
      }),
    });

    const joyrideFile = path.join(testUtil.testDataDir, '.joyride', 'example.cljs');
    await testUtil.openFile(joyrideFile);

    const resolved = replSession.getSession();
    assert.strictEqual(resolved, joyrideCljs);
  });

  it('uses is-fallback-for globs only when no always-claim match exists', async () => {
    const bbSession = createSession('bb');
    const cljSession = createSession('clj');

    sessionRegistry.registerSession('bb', bbSession, {
      globs: ['**/*.bb', '**/*.clj', '**/*.cljc'],
      globSpecs: globs.buildGlobSpecsFromTiers({
        'always-claim': ['**/*.bb'],
        'is-fallback-for': ['**/*.clj', '**/*.cljc'],
      }),
    });

    sessionRegistry.registerSession('clj', cljSession, {
      globs: ['**/*.clj'],
      globSpecs: globs.buildGlobSpecsFromTiers({
        'always-claim': ['**/*.clj'],
        'is-fallback-for': [],
      }),
    });

    const cljFilePath = path.join(testUtil.testDataDir, 'test.clj');
    await testUtil.openFile(cljFilePath);

    const resolved = replSession.getSession();
    assert.strictEqual(resolved, cljSession);
  });
});
