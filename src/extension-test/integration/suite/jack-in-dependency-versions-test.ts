import * as assert from 'assert';
import { before, after, suite, test } from 'mocha';
import * as vscode from 'vscode';
import * as state from '../../../state';
import * as testUtil from './util';
import {
  getEffectiveJackInDependencyVersions,
  JackInDependencyKey,
} from '../../../nrepl/jack-in-dependency-versions';

const SUITE = 'Jack-in dependency versions';
const GLOBAL_STATE_KEY = 'calva.jackIn.latestDependencyVersions';

type Versions = Partial<Record<JackInDependencyKey, string>>;

let prevWorkspaceValue: Versions | undefined;
let originalGlobalState: vscode.Memento | undefined;
let originalGet: vscode.Memento['get'] | undefined;
let originalUpdate: vscode.Memento['update'] | undefined;
let originalKeys: vscode.Memento['keys'] | undefined;
let memoryMemento: InMemoryMemento | undefined;

class InMemoryMemento implements vscode.Memento {
  private store: Record<string, unknown> = {};

  get<T>(key: string, defaultValue?: T): T | undefined {
    if (Object.prototype.hasOwnProperty.call(this.store, key)) {
      return this.store[key] as T;
    }
    return defaultValue;
  }

  update(key: string, value: unknown): Thenable<void> {
    if (value === undefined) {
      delete this.store[key];
      return Promise.resolve();
    }
    this.store[key] = value;
    return Promise.resolve();
  }

  keys(): readonly string[] {
    return Object.keys(this.store);
  }

  setKeysForSync(_keys: readonly string[]): void {
    // no-op for tests
  }
}

suite(SUITE, () => {
  before(async () => {
    const ext = vscode.extensions.getExtension('betterthantomorrow.calva');
    await ext?.activate();

    // Isolate global state to avoid cross-test and cross-run flakiness.
    originalGlobalState = state.extensionContext?.globalState;
    if (originalGlobalState) {
      originalGet = originalGlobalState.get.bind(originalGlobalState);
      originalUpdate = originalGlobalState.update.bind(originalGlobalState);
      originalKeys = originalGlobalState.keys?.bind(originalGlobalState);
      memoryMemento = new InMemoryMemento();
      (originalGlobalState as any).get = memoryMemento.get.bind(memoryMemento);
      (originalGlobalState as any).update = memoryMemento.update.bind(memoryMemento);
      (originalGlobalState as any).keys = memoryMemento.keys.bind(memoryMemento);
      (originalGlobalState as any).setKeysForSync =
        memoryMemento.setKeysForSync.bind(memoryMemento);
    }

    const inspected = vscode.workspace
      .getConfiguration('calva')
      .inspect<Versions>('jackInDependencyVersions');
    prevWorkspaceValue = inspected?.workspaceValue;
  });

  after(async () => {
    await vscode.workspace
      .getConfiguration('calva')
      .update('jackInDependencyVersions', prevWorkspaceValue, vscode.ConfigurationTarget.Workspace);
    if (originalGlobalState && originalGet && originalUpdate) {
      (originalGlobalState as any).get = originalGet;
      (originalGlobalState as any).update = originalUpdate;
      if (originalKeys) {
        (originalGlobalState as any).keys = originalKeys;
      }
    }
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
    // Clear global state to avoid influencing this test
    await state.extensionContext?.globalState.update(GLOBAL_STATE_KEY, {});

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

    await testUtil.waitForCondition(
      () => {
        const effective = getEffectiveJackInDependencyVersions();
        return (
          effective.nrepl === 'PARTIAL-NREPL-1' &&
          effective['cider-nrepl'] === defaults['cider-nrepl'] &&
          effective['cider/piggieback'] === defaults['cider/piggieback']
        );
      },
      1000,
      20,
      'Timed out waiting for partial jack-in dependency version configuration'
    );
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

  test('precedence: default is used when nothing is configured', async () => {
    const inspectedDefaults = vscode.workspace
      .getConfiguration('calva')
      .inspect<Record<JackInDependencyKey, string>>('jackInDependencyVersions');
    const defaults = (inspectedDefaults?.defaultValue ?? {}) as Record<JackInDependencyKey, string>;

    const ctx = state.extensionContext;
    if (ctx) {
      await ctx.globalState.update(GLOBAL_STATE_KEY, {});
    }
    await vscode.workspace
      .getConfiguration('calva')
      .update('jackInDependencyVersions', undefined, vscode.ConfigurationTarget.Workspace);

    const defaultsJson = JSON.stringify(defaults);
    await testUtil.waitForCondition(
      () => JSON.stringify(getEffectiveJackInDependencyVersions()) === defaultsJson,
      1000,
      20,
      'Timed out waiting for default jack-in dependency versions'
    );

    const effective = getEffectiveJackInDependencyVersions();

    assert.deepStrictEqual(
      effective,
      defaults,
      'effective should equal defaults when nothing is configured'
    );
  });
});
