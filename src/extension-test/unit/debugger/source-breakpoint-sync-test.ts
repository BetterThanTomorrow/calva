import * as expectLib from 'expect';
import { addedBreakpointsToSync } from '../../../../src/debugger/source-breakpoint-sync';

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
});
