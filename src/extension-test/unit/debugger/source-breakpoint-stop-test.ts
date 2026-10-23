import * as expectLib from 'expect';
import {
  routeSourceBreakpointStop,
  shouldExposeSourceBreakpointStop,
} from '../../../../src/debugger/source-breakpoint-stop';

describe('GUI source breakpoint stop selection', () => {
  const targets = [{ file: 'file:///sample.clj', formStart: 10, endOffset: 24 }];

  it('advances synthetic stops in the target form and exposes the configured stop', () => {
    expectLib
      .expect(shouldExposeSourceBreakpointStop(targets, 'file:///sample.clj', 10, 18))
      .toBe(false);
    expectLib
      .expect(shouldExposeSourceBreakpointStop(targets, 'file:///sample.clj', 10, 24))
      .toBe(true);
  });

  it('exposes ordinary stops outside the configured target form or file', () => {
    expectLib
      .expect(shouldExposeSourceBreakpointStop(targets, 'file:///sample.clj', 30, 24))
      .toBe(true);
    expectLib
      .expect(shouldExposeSourceBreakpointStop(targets, 'file:///other.clj', 10, 24))
      .toBe(true);
    expectLib
      .expect(shouldExposeSourceBreakpointStop(undefined, 'file:///sample.clj', 10, 18))
      .toBe(true);
  });

  it('routes the selected stop to the visible debugger or advances middleware', () => {
    const actions: string[] = [];
    const route = (offset: number) =>
      routeSourceBreakpointStop(
        shouldExposeSourceBreakpointStop(targets, 'file:///sample.clj', 10, offset),
        () => actions.push('expose'),
        () => actions.push('advance')
      );

    route(18);
    route(24);

    expectLib.expect(actions).toEqual(['advance', 'expose']);
  });
});
