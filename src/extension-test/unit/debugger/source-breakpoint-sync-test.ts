import * as expectLib from 'expect';
import {
  affectedBreakpointLocations,
  breakpointsToSync,
  reconcileBreakpointLocations,
  uniqueByKey,
} from '../../../../src/debugger/source-breakpoint-sync';
import { insertBreakpointForms } from '../../../../src/debugger/breakpoint-encoding';

const oldUri = 'file:///old.clj';
const newUri = 'file:///new.clj';

describe('source breakpoint sync', () => {
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
    const breakpoint: { uri: string; line: number; character: number } = {
      uri: oldUri,
      line: 2,
      character: 4,
    };
    const previous = new WeakMap<object, { uri: string; line: number; character: number }>();
    previous.set(breakpoint, { ...breakpoint });

    breakpoint.uri = newUri;
    breakpoint.line = 8;
    const moved = affectedBreakpointLocations(
      { added: [], changed: [breakpoint], removed: [] },
      previous,
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
      () => ({ uri: 'unused', line: 0, character: 0 }),
      () => true
    );
    expectLib.expect(removed).toEqual([{ uri: newUri, line: 8, character: 4 }]);
    expectLib.expect(previous.has(breakpoint)).toBe(false);
  });

  it('ignores non-Clojure breakpoints and keeps the remembered location for a removal', () => {
    const breakpoint = { uri: 'file:///x.txt', line: 0, character: 0, syncable: false };
    const previous = new WeakMap<object, { uri: string; line: number; character: number }>();
    previous.set(breakpoint, { uri: oldUri, line: 1, character: 0 });
    const locations = affectedBreakpointLocations(
      { added: [], changed: [], removed: [breakpoint] },
      previous,
      () => ({ uri: breakpoint.uri, line: breakpoint.line, character: breakpoint.character }),
      (item) => item.syncable
    );
    expectLib.expect(locations).toEqual([]);
    expectLib.expect(previous.has(breakpoint)).toBe(true);
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
