import * as expectLib from 'expect';
import { UnsupportedWarningState } from '../../../../src/debugger/unsupported-warning-state';

describe('unsupported debugger warning state', () => {
  it('suppresses repeats for the same session and capability state', () => {
    const state = new UnsupportedWarningState<object>();
    const session = {};

    expectLib.expect(state.shouldWarn(session, 'debug-input')).toBe(true);
    expectLib.expect(state.shouldWarn(session, 'debug-input')).toBe(false);
  });

  it('allows warnings for a different session or changed missing operations', () => {
    const state = new UnsupportedWarningState<object>();
    const sessionA = {};
    const sessionB = {};

    expectLib.expect(state.shouldWarn(sessionA, 'debug-input')).toBe(true);
    expectLib.expect(state.shouldWarn(sessionB, 'debug-input')).toBe(true);
    expectLib.expect(state.shouldWarn(sessionB, 'init-debugger')).toBe(true);
  });

  it('allows a fresh warning after the session capability is restored', () => {
    const state = new UnsupportedWarningState<object>();
    const session = {};

    expectLib.expect(state.shouldWarn(session, 'debug-input')).toBe(true);
    state.clear(session);
    expectLib.expect(state.shouldWarn(session, 'debug-input')).toBe(true);
  });
});
