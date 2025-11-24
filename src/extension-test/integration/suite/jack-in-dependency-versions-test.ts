import * as assert from 'assert';
import { before, after, suite, test } from 'mocha';
import * as vscode from 'vscode';
import * as state from '../../../state';
import * as testUtil from './util';
import {
  getEffectiveJackInDependencyVersions,
  JackInDependencyKey,
  refreshJackInDependencyVersions,
} from '../../../nrepl/jack-in-dependency-versions';

const SUITE = 'Jack-in dependency versions';
const GLOBAL_STATE_KEY = 'calva.jackIn.latestDependencyVersions';

type Versions = Partial<Record<JackInDependencyKey, string>>;

let prevWorkspaceValue: Versions | undefined;
let prevStoredValue: Versions | undefined;

const DEPENDENCY_KEYS: JackInDependencyKey[] = ['nrepl', 'cider-nrepl', 'cider/piggieback'];

function versionsMatch(a: Versions | undefined, b: Versions | undefined): boolean {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  const keys = new Set([...DEPENDENCY_KEYS, ...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const typedKey = key as JackInDependencyKey;
    if (a?.[typedKey] !== b?.[typedKey]) {
      return false;
    }
  }
  return true;
}

async function setStoredVersionsReliably(versions: Versions | undefined): Promise<void> {
  const timeoutMs = 10_000;
  const start = Date.now();
  while (true) {
    await state.extensionContext?.globalState.update(GLOBAL_STATE_KEY, versions);
    const current = state.extensionContext?.globalState.get<Versions>(GLOBAL_STATE_KEY);
    if (versionsMatch(current, versions)) {
      return;
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for stored versions to stabilize');
    }
    await testUtil.sleep(100);
  }
}

suite(SUITE, () => {
  before(async () => {
    const ext = vscode.extensions.getExtension('betterthantomorrow.calva');
    await ext?.activate();

    await refreshJackInDependencyVersions();

    const inspected = vscode.workspace
      .getConfiguration('calva')
      .inspect<Versions>('jackInDependencyVersions');
    prevWorkspaceValue = inspected?.workspaceValue;

    prevStoredValue = state.extensionContext?.globalState.get<Versions>(GLOBAL_STATE_KEY);
  });

  after(async () => {
    await vscode.workspace
      .getConfiguration('calva')
      .update('jackInDependencyVersions', prevWorkspaceValue, vscode.ConfigurationTarget.Workspace);

    await setStoredVersionsReliably(prevStoredValue);
  });

  test('happy path: uses configured versions when set at workspace level', async () => {
    const configured: Record<JackInDependencyKey, string> = {
      nrepl: 'TEST-NREPL-1',
      'cider-nrepl': 'TEST-CIDER-NREPL-2',
      'cider/piggieback': 'TEST-PIGGIEBACK-3',
    };

    await vscode.workspace
      .getConfiguration('calva')
      .update('jackInDependencyVersions', configured, vscode.ConfigurationTarget.Workspace);

    const effective = getEffectiveJackInDependencyVersions();

    assert.deepStrictEqual(
      effective,
      configured,
      `Expected configured versions to be used. Got ${JSON.stringify(effective)}`
    );
  });

  test('partial configuration: missing keys fall back while set keys are respected', async () => {
    // Clear stored values to avoid influencing this test
    await setStoredVersionsReliably({});

    const inspectedDefaults = vscode.workspace
      .getConfiguration('calva')
      .inspect<Record<JackInDependencyKey, string>>('jackInDependencyVersions');
    const defaults = (inspectedDefaults?.defaultValue ?? {}) as Record<JackInDependencyKey, string>;

    const configured: Versions = {
      nrepl: 'PARTIAL-NREPL-1',
    };

    await vscode.workspace
      .getConfiguration('calva')
      .update('jackInDependencyVersions', configured, vscode.ConfigurationTarget.Workspace);

    const effective = getEffectiveJackInDependencyVersions();

    assert.strictEqual(effective.nrepl, 'PARTIAL-NREPL-1', 'nrepl should use configured value');
    assert.strictEqual(
      effective['cider-nrepl'],
      defaults['cider-nrepl'],
      'cider-nrepl should fall back to default'
    );
    assert.strictEqual(
      effective['cider/piggieback'],
      defaults['cider/piggieback'],
      'cider/piggieback should fall back to default'
    );
  });

  test('precedence: stored values are used when nothing is configured', async () => {
    const stored: Record<JackInDependencyKey, string> = {
      nrepl: 'STORED-NREPL-1',
      'cider-nrepl': 'STORED-CIDER-2',
      'cider/piggieback': 'STORED-PIGGIE-3',
    };
    await setStoredVersionsReliably(stored);

    await vscode.workspace
      .getConfiguration('calva')
      .update('jackInDependencyVersions', undefined, vscode.ConfigurationTarget.Workspace);

    const effective = getEffectiveJackInDependencyVersions();
    assert.deepStrictEqual(
      effective,
      stored,
      'When nothing is configured, stored values should be used'
    );
  });

  test('precedence: configured overrides stored', async () => {
    const stored: Record<JackInDependencyKey, string> = {
      nrepl: 'STORED-NREPL-1',
      'cider-nrepl': 'STORED-CIDER-2',
      'cider/piggieback': 'STORED-PIGGIE-3',
    };
    await setStoredVersionsReliably(stored);

    const configured: Versions = {
      nrepl: 'CONFIG-NREPL-1',
      'cider/piggieback': 'CONFIG-PIGGIE-3',
    };
    await vscode.workspace
      .getConfiguration('calva')
      .update('jackInDependencyVersions', configured, vscode.ConfigurationTarget.Workspace);

    const effective = getEffectiveJackInDependencyVersions();
    assert.strictEqual(effective.nrepl, 'CONFIG-NREPL-1', 'configured should override stored');
    assert.strictEqual(
      effective['cider/piggieback'],
      'CONFIG-PIGGIE-3',
      'configured should override stored'
    );
    assert.strictEqual(
      effective['cider-nrepl'],
      'STORED-CIDER-2',
      'stored should be used when not configured'
    );
  });

  test('precedence: default is used when neither configured nor stored', async () => {
    const inspectedDefaults = vscode.workspace
      .getConfiguration('calva')
      .inspect<Record<JackInDependencyKey, string>>('jackInDependencyVersions');
    const defaults = (inspectedDefaults?.defaultValue ?? {}) as Record<JackInDependencyKey, string>;

    await setStoredVersionsReliably({});
    await vscode.workspace
      .getConfiguration('calva')
      .update('jackInDependencyVersions', undefined, vscode.ConfigurationTarget.Workspace);

    const effective = getEffectiveJackInDependencyVersions();

    assert.deepStrictEqual(
      effective,
      defaults,
      'effective should equal defaults when nothing is configured or stored'
    );
  });
});
