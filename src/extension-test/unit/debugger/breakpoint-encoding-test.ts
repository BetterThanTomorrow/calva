import * as expectLib from 'expect';
import {
  breakpointForm,
  insertBreakpointForms,
} from '../../../../src/debugger/breakpoint-encoding';

describe('gutter breakpoint encoding', () => {
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

  it('puts a space before #break when it would otherwise join the token before it', () => {
    expectLib
      .expect(insertBreakpointForms('(+ x(inc y))', [{ offset: 4 }]))
      .toBe('(+ x #break (inc y))');
    expectLib
      .expect(insertBreakpointForms('(cond :else(foo))', [{ offset: 11 }]))
      .toBe('(cond :else #break (foo))');
  });

  it('puts no space before #break after whitespace, a comma or an opening bracket', () => {
    expectLib
      .expect(
        insertBreakpointForms('[(a) ,(b) {:c (d)}]', [{ offset: 1 }, { offset: 6 }, { offset: 14 }])
      )
      .toBe('[#break (a) ,#break (b) {:c #break (d)}]');
  });
});
