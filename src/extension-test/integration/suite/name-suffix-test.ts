import * as assert from 'assert';
import { before, after, beforeEach } from 'mocha';
import * as path from 'path';
import * as outputWindow from '../../../repl-window/repl-window-doc';
import * as clientRegistry from '../../../nrepl/client-registry';
import * as sessionRegistry from '../../../nrepl/session-registry';
import * as nameSuffix from '../../../nrepl/session-name-suffix';
import * as jackIn from '../../../nrepl/jack-in';
import connector from '../../../connector';
import * as testUtil from './util';

const suiteName = 'Name Suffix';

suite('Name Suffix suite', () => {
  const jackInHarness = new testUtil.JackInHarness(suiteName);
  const firstProjectFile = path.join(testUtil.testDataDir, 'bb-mini', 'test.clj');
  const secondProjectFile = path.join(testUtil.testDataDir, 'bb-mini2', 'test.clj');

  let baseClientKey: string | undefined;
  let secondClientKey: string | undefined;

  before(async () => {
    testUtil.showMessage(suiteName, `suite starting!`);
    await testUtil.ensureOutputDir(testUtil.testDataDir);
    await jackInHarness.disconnectAllClients();
    nameSuffix.resetPool();
  });

  after(async () => {
    testUtil.showMessage(suiteName, `suite done!`);
    await jackIn.calvaJackout({ force: true });
    await testUtil.waitForJackOutComplete(suiteName);
    nameSuffix.resetPool();
  });

  beforeEach(async () => {
    await outputWindow.clearReplWindowDoc();
    jackInHarness.reset();
    await ensureBaseConnection();
  });

  test('Second project with same session names gets suffix', async function () {
    this.timeout(120_000);
    testUtil.log(suiteName, 'Testing: Second project gets suffix');

    const firstClientKey = await ensureBaseConnection();
    const secondClientKey = await ensureSecondConnection();
    const firstSessions = sessionRegistry.listSessionsByClient(firstClientKey);
    const firstSessionKeys = firstSessions.map((s) => s.key);
    testUtil.log(suiteName, 'First project session keys:', firstSessionKeys);

    assert.ok(
      firstSessionKeys.includes('bb'),
      `First project should have 'bb' session, got: ${firstSessionKeys}`
    );

    const allClients = clientRegistry.listClients();
    assert.strictEqual(allClients.length, 2, 'Should have two clients after second jack-in');

    const secondSessions = sessionRegistry.listSessionsByClient(secondClientKey);
    const secondSessionKeys = secondSessions.map((s) => s.key);
    testUtil.log(suiteName, 'Second project session keys:', secondSessionKeys);

    const hasSuffix = secondSessionKeys.some((key) => nameSuffix.extractSuffix(key));
    assert.ok(hasSuffix, `Second project should have suffixed sessions, got: ${secondSessionKeys}`);

    const usedSuffix = await getSuffixForClient(secondClientKey);
    assert.ok(usedSuffix, 'Second connection should have a suffix');
    testUtil.log(suiteName, 'Second project suffix:', usedSuffix);
  });

  test('Disconnecting releases suffix back to pool', async function () {
    this.timeout(120_000);
    testUtil.log(suiteName, 'Testing: Disconnect releases suffix');

    await ensureBaseConnection();
    const secondClientKey = await ensureSecondConnection();

    const clientsBeforeDisconnect = clientRegistry.listClients();
    assert.strictEqual(
      clientsBeforeDisconnect.length,
      2,
      'Should have two clients before disconnect'
    );
    const usedSuffix = await getSuffixForClient(secondClientKey);

    testUtil.log(suiteName, 'Suffix used before disconnect:', usedSuffix);
    assert.ok(usedSuffix, 'Second connection should have a suffix');

    const availableBefore = nameSuffix.getAvailableSuffixes();
    assert.ok(
      !availableBefore.includes(usedSuffix),
      `Suffix '${usedSuffix}' should not be available while in use`
    );

    await connector.disconnect({ clientKey: secondClientKey });
    await testUtil.waitForCondition(
      () => nameSuffix.getAvailableSuffixes().includes(usedSuffix),
      10_000,
      20,
      `Timed out waiting for suffix '${usedSuffix}' to be released`
    );

    const availableAfter = nameSuffix.getAvailableSuffixes();
    assert.ok(
      availableAfter.includes(usedSuffix),
      `Suffix '${usedSuffix}' should be available after disconnect`
    );

    testUtil.log(suiteName, 'Suffix released successfully:', usedSuffix);
  });

  async function ensureBaseConnection(): Promise<string> {
    if (baseClientKey) {
      const existing = clientRegistry.getClient(baseClientKey);
      if (existing) {
        return baseClientKey;
      }
    }

    const sequence = {
      name: 'First Babashka Connection',
      projectType: 'babashka',
      cljsType: 'none',
      projectRootPath: [path.dirname(firstProjectFile)],
    };
    baseClientKey = await jackInHarness.jackInWithConnectSequence(firstProjectFile, sequence);
    return baseClientKey;
  }

  async function ensureSecondConnection(): Promise<string> {
    if (secondClientKey) {
      const existing = clientRegistry.getClient(secondClientKey);
      if (existing) {
        return secondClientKey;
      }
    }

    const sequence = {
      name: 'Second Babashka Connection',
      projectType: 'babashka',
      cljsType: 'none',
      projectRootPath: [path.dirname(secondProjectFile)],
    };
    secondClientKey = await jackInHarness.jackInWithConnectSequence(secondProjectFile, sequence);
    return secondClientKey;
  }

  async function getSuffixForClient(clientKey: string): Promise<string | undefined> {
    const state = clientRegistry.getConnectionState(clientKey);
    if (state?.suffix) {
      return state.suffix;
    }

    const sessions = sessionRegistry.listSessionsByClient(clientKey);
    const suffix = sessions.map((s) => nameSuffix.extractSuffix(s.key)).find(Boolean);
    return await Promise.resolve(suffix);
  }
});
