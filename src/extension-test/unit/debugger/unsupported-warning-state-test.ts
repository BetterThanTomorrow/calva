import * as expectLib from 'expect';
import { UnsupportedWarningState } from '../../../../src/debugger/unsupported-warning-state';

const DEBUG_INPUT = 'debug-input';
const INIT_DEBUGGER = 'init-debugger';

describe('unsupported debugger warning state', () => {
  it('suppresses repeats for the same session and capability state', () => {
    const state = new UnsupportedWarningState<object>();
    const session = {};

    expectLib.expect(state.shouldWarn(session, DEBUG_INPUT)).toBe(true);
    expectLib.expect(state.shouldWarn(session, DEBUG_INPUT)).toBe(false);
  });

  it('allows warnings for a different session or changed missing operations', () => {
    const state = new UnsupportedWarningState<object>();
    const sessionA = {};
    const sessionB = {};

    expectLib.expect(state.shouldWarn(sessionA, DEBUG_INPUT)).toBe(true);
    expectLib.expect(state.shouldWarn(sessionB, DEBUG_INPUT)).toBe(true);
    expectLib.expect(state.shouldWarn(sessionB, INIT_DEBUGGER)).toBe(true);
  });

  it('allows a fresh warning after the session capability is restored', () => {
    const state = new UnsupportedWarningState<object>();
    const session = {};

    expectLib.expect(state.shouldWarn(session, DEBUG_INPUT)).toBe(true);
    state.clear(session);
    expectLib.expect(state.shouldWarn(session, DEBUG_INPUT)).toBe(true);
  });
});
