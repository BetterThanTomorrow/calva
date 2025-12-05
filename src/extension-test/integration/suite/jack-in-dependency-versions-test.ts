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
      // originalSetKeysForSync = originalGlobalState.setKeysForSync?.bind(originalGlobalState);

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
      // Removed handling for setKeysForSync
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
    // Clear stored values to avoid influencing this test
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
    const ctx = state.extensionContext;
    if (ctx) {
      await ctx.globalState.update(GLOBAL_STATE_KEY, stored);
    }

    await testUtil.sleep(20);
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
    await state.extensionContext?.globalState.update(GLOBAL_STATE_KEY, stored);

    const configured: Versions = {
      nrepl: 'CONFIG-NREPL-1',
      'cider/piggieback': 'CONFIG-PIGGIE-3',
    };
    await vscode.workspace
      .getConfiguration('calva')
      .update('jackInDependencyVersions', configured, vscode.ConfigurationTarget.Workspace);

    await testUtil.sleep(20);

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

    const ctx = state.extensionContext;
    if (ctx) {
      await ctx.globalState.update(GLOBAL_STATE_KEY, {});
    }
    await vscode.workspace
      .getConfiguration('calva')
      .update('jackInDependencyVersions', undefined, vscode.ConfigurationTarget.Workspace);

    await testUtil.sleep(20);

    const effective = getEffectiveJackInDependencyVersions();

    assert.deepStrictEqual(
      effective,
      defaults,
      'effective should equal defaults when nothing is configured or stored'
    );
  });
});
