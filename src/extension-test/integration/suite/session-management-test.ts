import * as assert from 'assert';
import * as Mocha from 'mocha';
import * as path from 'path';
import * as sessionRegistry from '../../../nrepl/session-registry';
import * as outputWindow from '../../../repl-window/repl-doc';
import connector from '../../../connector';
import * as replApi from '../../../api/repl-v1';
import * as replSession from '../../../nrepl/repl-session';
import * as cljsLib from '../../../../out/cljs-lib/cljs-lib';
import type { NReplSession } from '../../../nrepl';
import * as testUtil from './util';
import * as sessionRouting from '../../../nrepl/session-routing';

const { describe, before, beforeEach, afterEach, it } = Mocha;

const suiteName = 'Session management';
const serverSessionKey = 'session-management/server';
const uiSessionKey = 'session-management/ui';

const createSession = (replType: string): NReplSession =>
  ({
    replType,
  } as NReplSession);

const resetOutputWindowSession = (sessionType: string, ns: string): void => {
  outputWindow.setSession(createSession(sessionType), ns, sessionType);
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
    await outputWindow.initResultsDoc();
  });

  beforeEach(() => {
    sessionRegistry.clearAllSessions();
    cljsLib.setStateValue('connected', true);
    cljsLib.setStateValue('current-session-type', undefined);
    sessionRouting.resetRouting();
    resetOutputWindowSession('clj', 'user');
  });

  afterEach(() => {
    sessionRegistry.clearAllSessions();
    cljsLib.setStateValue('connected', initialConnectionState);
    cljsLib.setStateValue('current-session-type', initialCurrentSessionType);
    sessionRouting.resetRouting();
    const fallbackSessionType = initialOutputSessionType ?? 'clj';
    const fallbackNamespace = initialOutputNamespace ?? 'user';
    resetOutputWindowSession(fallbackSessionType, fallbackNamespace);
  });

  it('exposes registered sessions through the public API', () => {
    sessionRegistry.registerSession(serverSessionKey, createSession('clj'), {
      name: 'Server',
      projectRoot: 'file:///server',
      globs: ['apps/server/**'],
    });
    sessionRegistry.registerSession(uiSessionKey, createSession('cljs'), {
      name: 'UI',
      projectRoot: 'file:///ui',
      globs: ['apps/ui/**'],
    });

    const sessions = replApi.listSessions();
    assert.strictEqual(sessions.length, 2);
    const keys = sessions.map((s) => s.key).sort();
    assert.deepStrictEqual(keys, [serverSessionKey, uiSessionKey]);
    const serverMeta = sessions.find((s) => s.key === serverSessionKey);
    assert.strictEqual(serverMeta.name, 'Server');
    assert.deepStrictEqual(serverMeta.globs, ['apps/server/**']);
  });

  it('toggle command cycles through registered session keys', async () => {
    sessionRegistry.registerSession(serverSessionKey, createSession('clj'), {
      name: 'Server',
      globs: ['**/*.clj'],
    });
    sessionRegistry.registerSession(uiSessionKey, createSession('cljs'), {
      name: 'UI',
      globs: ['**/*.cljs'],
    });

    cljsLib.setStateValue('current-session-type', serverSessionKey);
    assert.strictEqual(sessionRouting.getCljcSessionKey(), undefined);

    connector.toggleCLJCSession();

    assert.strictEqual(sessionRouting.getCljcSessionKey(), uiSessionKey);

    connector.toggleCLJCSession();

    assert.strictEqual(sessionRouting.getCljcSessionKey(), serverSessionKey);
  });

  it('honors session glob mappings when resolving active files', async () => {
    const cljSession = createSession('clj');
    const cljsSession = createSession('cljs');
    sessionRegistry.registerSession(serverSessionKey, cljSession, {
      name: 'Server',
      globs: ['**/*.clj'],
    });
    sessionRegistry.registerSession(uiSessionKey, cljsSession, {
      name: 'UI',
      globs: ['**/*.cljs'],
    });

    const testFilePath = path.join(testUtil.testDataDir, 'test.clj');
    await testUtil.openFile(testFilePath);

    const resolved = replSession.getSession();
    assert.strictEqual(resolved, cljSession);
  });

  it('prefers pinned sessions over glob routing', async () => {
    const cljSession = createSession('clj');
    const cljsSession = createSession('cljs');
    sessionRegistry.registerSession(serverSessionKey, cljSession, {
      name: 'Server',
      globs: ['**/*.clj'],
    });
    sessionRegistry.registerSession(uiSessionKey, cljsSession, {
      name: 'UI',
      globs: ['**/*.cljs'],
    });

    sessionRouting.pinSession(uiSessionKey);

    const testFilePath = path.join(testUtil.testDataDir, 'test.clj');
    await testUtil.openFile(testFilePath);

    const resolved = replSession.getSession();
    assert.strictEqual(resolved, cljsSession);
  });

  it('routes cljc files using the cljc-specific override', async () => {
    const cljSession = createSession('clj');
    const cljsSession = createSession('cljs');
    sessionRegistry.registerSession(serverSessionKey, cljSession, {
      name: 'Server',
      globs: ['**/*.clj'],
    });
    sessionRegistry.registerSession(uiSessionKey, cljsSession, {
      name: 'UI',
      globs: ['**/*.cljs'],
    });

    sessionRouting.setCljcSessionKey(serverSessionKey);

    const cljcFilePath = path.join(testUtil.testDataDir, 'test.cljc');
    await testUtil.openFile(cljcFilePath);

    const resolved = replSession.getSession();
    assert.strictEqual(resolved, cljSession);

    const cljFilePath = path.join(testUtil.testDataDir, 'test.clj');
    await testUtil.openFile(cljFilePath);
    const resolvedClj = replSession.getSession();
    assert.strictEqual(resolvedClj, cljSession);

    sessionRouting.setCljcSessionKey(uiSessionKey);
    await testUtil.openFile(cljcFilePath);
    const resolvedCljc = replSession.getSession();
    assert.strictEqual(resolvedCljc, cljsSession);
  });

  it('keeps pinned sessions active even when a cljc override is set', async () => {
    const cljSession = createSession('clj');
    const cljsSession = createSession('cljs');
    sessionRegistry.registerSession(serverSessionKey, cljSession, {
      name: 'Server',
      globs: ['**/*.clj'],
    });
    sessionRegistry.registerSession(uiSessionKey, cljsSession, {
      name: 'UI',
      globs: ['**/*.cljs'],
    });

    sessionRouting.setCljcSessionKey(serverSessionKey);
    sessionRouting.pinSession(uiSessionKey);

    const cljcFilePath = path.join(testUtil.testDataDir, 'test.cljc');
    await testUtil.openFile(cljcFilePath);

    const resolvedPinned = replSession.getSession();
    assert.strictEqual(resolvedPinned, cljsSession);
  });

  it('treats files without glob matches as cljc selections', async () => {
    const cljSession = createSession('clj');
    const cljsSession = createSession('cljs');
    sessionRegistry.registerSession(serverSessionKey, cljSession, {
      name: 'Server',
      globs: ['**/*.clj'],
    });
    sessionRegistry.registerSession(uiSessionKey, cljsSession, {
      name: 'UI',
      globs: ['**/*.cljs'],
    });

    sessionRouting.setCljcSessionKey(serverSessionKey);

    const unmatchedFilePath = path.join(testUtil.testDataDir, 'test-files', 'javascript-code.js');
    await testUtil.openFile(unmatchedFilePath);

    const resolvedUnmatched = replSession.getSession();
    assert.strictEqual(resolvedUnmatched, cljSession);

    sessionRouting.setCljcSessionKey(uiSessionKey);
    await testUtil.openFile(unmatchedFilePath);

    const rerouted = replSession.getSession();
    assert.strictEqual(rerouted, cljsSession);
  });
});
