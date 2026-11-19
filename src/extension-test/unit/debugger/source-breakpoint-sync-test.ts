import * as expectLib from 'expect';
import {
  affectedBreakpointLocations,
  breakpointsToSync,
  enabledBreakpoints,
  reconcileBreakpointLocations,
  updateBreakpointEnabledState,
  uniqueByKey,
} from '../../../../src/debugger/source-breakpoint-sync';
import { insertBreakpointForms } from '../../../../src/debugger/breakpoint-encoding';
import {
  consumeDisabledSourceBreakpointStopTarget,
  mergeSourceBreakpointStopTargets,
  routeMappedSourceBreakpointStop,
  updateBreakpointStopTargets,
} from '../../../../src/debugger/source-breakpoint-stop';

const oldUri = 'file:///old.clj';
const newUri = 'file:///new.clj';

async function verifyActiveSessionBreakpointToggleLifecycle(): Promise<void> {
  const breakpoint = {
    id: 'gui',
    enabled: true,
    offset: 0,
    condition: undefined as string | undefined,
  };
  const target = {
    file: oldUri,
    formStart: 10,
    endOffset: 24,
    enabled: true,
    breakpointId: breakpoint.id,
  };
  const targets = [target];
  const enabledById = new Map([[breakpoint.id, true]]);
  let debuggerInitialized = false;
  const evaluations: string[] = [];
  const reconcile = () =>
    reconcileBreakpointLocations(
      [{ uri: oldUri, line: 2, character: 4 }],
      (location) => Promise.resolve({ location }),
      () => 'sample',
      () => enabledBreakpoints([breakpoint], enabledById),
      (_form, activeBreakpoints) => {
        if (activeBreakpoints.length > 0 && !debuggerInitialized) {
          debuggerInitialized = true;
          evaluations.push('initialize-debugger');
        }
        const code = insertBreakpointForms(
          '(sample)',
          activeBreakpoints.map((item) => ({ offset: item.offset, condition: item.condition }))
        );
        evaluations.push(code);
        if (activeBreakpoints.length > 0) {
          mergeSourceBreakpointStopTargets(targets, [target]);
        }
        return Promise.resolve();
      },
      (error) => {
        throw error;
      }
    );

  breakpoint.enabled = false;
  updateBreakpointEnabledState(
    { added: [], changed: [breakpoint], removed: [] },
    enabledById,
    (item) => item.id
  );
  updateBreakpointStopTargets(targets, [breakpoint], []);
  await reconcile();

  expectLib.expect(evaluations).toEqual(['(sample)']);
  expectLib
    .expect(
      await routeMappedSourceBreakpointStop({
        getTargets: () => targets,
        getGeneration: () => 1,
        mapStop: () => Promise.resolve({ file: oldUri, formStart: 10, stopOffset: 24 }),
        consumeDisabled: (stop) =>
          consumeDisabledSourceBreakpointStopTarget(
            targets,
            stop.file,
            stop.formStart,
            stop.stopOffset
          ),
      })
    )
    .toBe(false);

  breakpoint.enabled = true;
  updateBreakpointEnabledState(
    { added: [], changed: [breakpoint], removed: [] },
    enabledById,
    (item) => item.id
  );
  updateBreakpointStopTargets(targets, [breakpoint], []);
  await reconcile();

  expectLib.expect(evaluations).toEqual(['(sample)', 'initialize-debugger', '#break (sample)']);
  expectLib.expect(debuggerInitialized).toBe(true);
  expectLib
    .expect(
      await routeMappedSourceBreakpointStop({
        getTargets: () => targets,
        getGeneration: () => 2,
        mapStop: () => Promise.resolve({ file: oldUri, formStart: 10, stopOffset: 24 }),
      })
    )
    .toBe(true);
}

describe('source breakpoint sync', () => {
  it('filters disabled breakpoints from the active snapshot and restores them when enabled', () => {
    const breakpoint = { id: 'gui', enabled: false };
    expectLib.expect(enabledBreakpoints([breakpoint])).toEqual([]);

    breakpoint.enabled = true;
    expectLib.expect(enabledBreakpoints([breakpoint])).toEqual([breakpoint]);
  });

  it('uses changed-event enabled state when the VS Code snapshot is stale', () => {
    const snapshot = [{ id: 'gui', enabled: true }];
    const currentState = new Map<string, boolean>([['gui', true]]);

    updateBreakpointEnabledState(
      { added: [], changed: [{ id: 'gui', enabled: false }], removed: [] },
      currentState,
      (breakpoint) => breakpoint.id
    );
    expectLib.expect(enabledBreakpoints(snapshot, currentState)).toEqual([]);

    updateBreakpointEnabledState(
      { added: [], changed: [{ id: 'gui', enabled: true }], removed: [] },
      currentState,
      (breakpoint) => breakpoint.id
    );
    const staleSnapshot = [{ id: 'gui', enabled: false }];
    const activeSnapshot = enabledBreakpoints(staleSnapshot, currentState);
    expectLib.expect(activeSnapshot).toHaveLength(1);
    expectLib.expect(activeSnapshot[0]).toBe(staleSnapshot[0]);
  });

  it('preserves breakpoint instances while applying remembered enabled state', () => {
    class Breakpoint {
      constructor(public id: string, public enabled: boolean) {}
    }
    const breakpoint = new Breakpoint('gui', true);
    const state = new Map([[breakpoint.id, false]]);

    expectLib.expect(enabledBreakpoints([breakpoint], state)).toEqual([]);
    state.set(breakpoint.id, true);
    const activeBreakpoints = enabledBreakpoints([breakpoint], state);

    expectLib.expect(activeBreakpoints[0]).toBeInstanceOf(Breakpoint);
    expectLib.expect(activeBreakpoints[0]).toBe(breakpoint);
  });

  it('reconciles an enabled-state change using the latest active breakpoint snapshot', async () => {
    const breakpoint = {
      id: 'gui',
      enabled: true,
      form: 'sample',
      offset: 0,
      condition: undefined as string | undefined,
    };
    const previous = new Map<string, { uri: string; line: number; character: number }>();
    previous.set(breakpoint.id, { uri: oldUri, line: 2, character: 4 });
    const locations = affectedBreakpointLocations(
      { added: [], changed: [breakpoint], removed: [] },
      previous,
      (item) => item.id,
      () => ({ uri: oldUri, line: 2, character: 4 }),
      () => true
    );
    breakpoint.enabled = false;
    const snapshots: string[][] = [];
    const instrumented: string[] = [];

    const reconcile = () =>
      reconcileBreakpointLocations(
        locations,
        (location) => Promise.resolve({ location }),
        () => 'sample',
        () => enabledBreakpoints([breakpoint]),
        (_target, breakpoints) => {
          snapshots.push(breakpoints.map((item) => item.id));
          instrumented.push(
            insertBreakpointForms(
              '(sample)',
              breakpoints.map((item) => ({ offset: item.offset, condition: item.condition }))
            )
          );
          return Promise.resolve();
        },
        (error) => {
          throw error;
        }
      );

    await reconcile();

    expectLib.expect(locations).toEqual([
      { uri: oldUri, line: 2, character: 4 },
      { uri: oldUri, line: 2, character: 4 },
    ]);
    expectLib.expect(snapshots).toEqual([[]]);
    expectLib.expect(instrumented).toEqual(['(sample)']);

    breakpoint.enabled = true;
    await reconcile();
    expectLib.expect(snapshots.slice(1)).toEqual([['gui']]);
    expectLib.expect(instrumented.slice(1)).toEqual(['#break (sample)']);
  });

  it(
    'disables a stale stop and restores instrumentation after initializing on re-enable',
    verifyActiveSessionBreakpointToggleLifecycle
  );

  it('reevaluates the remembered location when VS Code replaces a changed breakpoint object', () => {
    const previous = new Map<string, { uri: string; line: number; character: number }>([
      ['gui', { uri: oldUri, line: 2, character: 4 }],
    ]);
    const changedBreakpoint = { id: 'gui', enabled: false, uri: oldUri, line: 2, character: 4 };

    const locations = affectedBreakpointLocations(
      { added: [], changed: [changedBreakpoint], removed: [] },
      previous,
      (breakpoint) => breakpoint.id,
      (breakpoint) => ({ uri: breakpoint.uri, line: breakpoint.line, character: 4 }),
      () => true
    );

    expectLib.expect(locations).toEqual([
      { uri: oldUri, line: 2, character: 4 },
      { uri: oldUri, line: 2, character: 4 },
    ]);
    expectLib.expect(previous.get('gui')).toEqual({ uri: oldUri, line: 2, character: 4 });
  });

  it('reconciles added, changed, and removed breakpoints', () => {
    const addedBreakpoint = { id: 'added', syncable: true };
    const changedBreakpoint = { id: 'changed', syncable: true };
    const removedBreakpoint = { id: 'removed', syncable: true };

    const breakpoints = breakpointsToSync(
      {
        added: [addedBreakpoint],
        changed: [changedBreakpoint],
        removed: [removedBreakpoint],
      },
      (breakpoint) => breakpoint.syncable
    );

    expectLib.expect(breakpoints).toEqual([addedBreakpoint, changedBreakpoint, removedBreakpoint]);
  });

  it('filters added breakpoints through the syncable predicate', () => {
    const clojureBreakpoint = { id: 'clojure', syncable: true };
    const nonClojureBreakpoint = { id: 'non-clojure', syncable: false };

    const breakpoints = breakpointsToSync(
      {
        added: [clojureBreakpoint, nonClojureBreakpoint],
        changed: [],
        removed: [],
      },
      (breakpoint) => breakpoint.syncable
    );

    expectLib.expect(breakpoints).toEqual([clojureBreakpoint]);
  });

  it('deduplicates breakpoints that resolve to the same top-level form', () => {
    const first = { form: 'a', breakpoint: 1 };
    const duplicate = { form: 'a', breakpoint: 2 };
    const otherForm = { form: 'b', breakpoint: 3 };

    expectLib
      .expect(uniqueByKey([first, duplicate, otherForm], (item) => item.form))
      .toEqual([first, otherForm]);
  });

  it('reevaluates the saved location on removal and both locations on a move', () => {
    const breakpoint: { id: string; uri: string; line: number; character: number } = {
      id: 'gui',
      uri: oldUri,
      line: 2,
      character: 4,
    };
    const previous = new Map<string, { uri: string; line: number; character: number }>();
    previous.set(breakpoint.id, { uri: oldUri, line: 2, character: 4 });

    breakpoint.uri = newUri;
    breakpoint.line = 8;
    const moved = affectedBreakpointLocations(
      { added: [], changed: [breakpoint], removed: [] },
      previous,
      (item) => item.id,
      (item) => ({ uri: item.uri, line: item.line, character: item.character }),
      () => true
    );
    expectLib.expect(moved).toEqual([
      { uri: oldUri, line: 2, character: 4 },
      { uri: newUri, line: 8, character: 4 },
    ]);

    const removed = affectedBreakpointLocations(
      { added: [], changed: [], removed: [breakpoint] },
      previous,
      (item) => item.id,
      () => ({ uri: 'unused', line: 0, character: 0 }),
      () => true
    );
    expectLib.expect(removed).toEqual([{ uri: newUri, line: 8, character: 4 }]);
    expectLib.expect(previous.has(breakpoint.id)).toBe(false);
  });

  it('ignores non-Clojure breakpoints and keeps the remembered location for a removal', () => {
    const breakpoint = {
      id: 'other',
      uri: 'file:///x.txt',
      line: 0,
      character: 0,
      syncable: false,
    };
    const previous = new Map<string, { uri: string; line: number; character: number }>();
    previous.set(breakpoint.id, { uri: oldUri, line: 1, character: 0 });
    const locations = affectedBreakpointLocations(
      { added: [], changed: [], removed: [breakpoint] },
      previous,
      (item) => item.id,
      () => ({ uri: breakpoint.uri, line: breakpoint.line, character: breakpoint.character }),
      (item) => item.syncable
    );
    expectLib.expect(locations).toEqual([]);
    expectLib.expect(previous.has(breakpoint.id)).toBe(true);
  });

  it('reevaluates removed and moved forms using one current breakpoint snapshot', async () => {
    const locations = ['removed', 'moved-old', 'moved-new', 'changed'];
    const activeBreakpoints: { form: string; condition?: string }[] = [
      { form: 'moved-new', condition: undefined },
      { form: 'changed', condition: '(= x 2)' },
    ];
    const evaluated: Record<string, string> = {};
    let snapshotCount = 0;
    let usedSnapshot: readonly { form: string; condition?: string }[] | undefined;

    await reconcileBreakpointLocations(
      locations,
      (form) => Promise.resolve({ form }),
      (target) => target.form,
      () => {
        snapshotCount++;
        return activeBreakpoints;
      },
      (target, breakpoints) => {
        usedSnapshot ??= breakpoints;
        expectLib.expect(breakpoints).toBe(usedSnapshot);
        const insertion = breakpoints
          .filter((breakpoint) => breakpoint.form === target.form)
          .map((breakpoint) => ({ offset: 0, condition: breakpoint.condition }));
        evaluated[target.form] = insertBreakpointForms('(work)', insertion);
        if (target.form === 'removed') {
          activeBreakpoints.push({ form: 'late-change' });
        }
        return Promise.resolve();
      },
      (error) => {
        throw error;
      }
    );

    expectLib.expect(evaluated.removed).toBe('(work)');
    expectLib.expect(evaluated['moved-old']).toBe('(work)');
    expectLib.expect(evaluated['moved-new']).toBe('#break (work)');
    expectLib.expect(evaluated.changed).toBe('#break ^{:break/when (= x 2)} (work)');
    expectLib.expect(snapshotCount).toBe(1);
    expectLib.expect(usedSnapshot).toHaveLength(2);
    expectLib.expect(activeBreakpoints).toHaveLength(3);
  });

  it('deduplicates forms, preserves evaluation order, and continues after failures', async () => {
    const attempted: string[] = [];
    const evaluated: string[] = [];
    const errors: unknown[] = [];

    await reconcileBreakpointLocations(
      ['first', 'same-form', 'same-form-again', 'broken', 'last'],
      (location) => {
        attempted.push(location);
        if (location === 'broken') {
          return Promise.reject(new Error('unavailable'));
        }
        return Promise.resolve({ form: location.startsWith('same-form') ? 'shared' : location });
      },
      (target) => target.form,
      () => [],
      (target) => {
        evaluated.push(target.form);
        if (target.form === 'first') {
          return Promise.reject(new Error('evaluation failed'));
        }
        return Promise.resolve();
      },
      (error) => errors.push(error)
    );

    expectLib
      .expect(attempted)
      .toEqual(['first', 'same-form', 'same-form-again', 'broken', 'last']);
    expectLib.expect(evaluated).toEqual(['first', 'shared', 'last']);
    expectLib.expect(errors).toHaveLength(2);
  });
});
