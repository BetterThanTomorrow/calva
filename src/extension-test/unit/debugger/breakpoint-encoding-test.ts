import * as expectLib from 'expect';
import {
  breakpointForm,
  insertBreakpointForms,
  isBreakpointSupported,
} from '../../../../src/debugger/breakpoint-encoding';

describe('GUI breakpoint encoding', () => {
  it('encodes conditional expressions in middleware metadata', () => {
    expectLib.expect(breakpointForm('(= x 1)')).toBe('#break ^{:break/when (= x 1)} ');
  });

  it('encodes unconditional breakpoints', () => {
    expectLib.expect(breakpointForm()).toBe('#break ');
  });

  it('preserves distinct conditions and original offsets while inserting from right to left', () => {
    expectLib
      .expect(
        insertBreakpointForms('(one) (two)', [{ offset: 0 }, { offset: 6, condition: '(= x 1)' }])
      )
      .toBe('#break (one) #break ^{:break/when (= x 1)} (two)');
  });

  it('preserves two breakpoints that resolve to the same form', () => {
    expectLib
      .expect(insertBreakpointForms('(one)', [{ offset: 0 }, { offset: 0, condition: '(= x 1)' }]))
      .toBe('#break ^{:break/when (= x 1)} #break (one)');
  });

  it('marks breakpoints supported only for Clojure sources with debugger operations', () => {
    expectLib.expect(isBreakpointSupported(true, true)).toBe(true);
    expectLib.expect(isBreakpointSupported(true, false)).toBe(false);
    expectLib.expect(isBreakpointSupported(false, true)).toBe(false);
  });
});
