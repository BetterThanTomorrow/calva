import * as expectLib from 'expect';
import {
  addedBreakpointsToSync,
  uniqueByKey,
} from '../../../../src/debugger/source-breakpoint-sync';

describe('source breakpoint sync', () => {
  it('syncs only newly added breakpoints', () => {
    const addedBreakpoint = { id: 'added', syncable: true };
    const changedBreakpoint = { id: 'changed', syncable: true };
    const removedBreakpoint = { id: 'removed', syncable: true };

    const breakpoints = addedBreakpointsToSync(
      {
        added: [addedBreakpoint],
        changed: [changedBreakpoint],
        removed: [removedBreakpoint],
      },
      (breakpoint) => breakpoint.syncable
    );

    expectLib.expect(breakpoints).toEqual([addedBreakpoint]);
  });

  it('filters added breakpoints through the syncable predicate', () => {
    const clojureBreakpoint = { id: 'clojure', syncable: true };
    const nonClojureBreakpoint = { id: 'non-clojure', syncable: false };

    const breakpoints = addedBreakpointsToSync(
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
});
