import * as expectLib from 'expect';
import {
  DebugSessionState,
  synchronizeDebugResponse,
} from '../../../../src/debugger/debug-session-state';
import { handleNreplDebugCompletion } from '../../../../src/debugger/request-handlers';

describe('debug session shared state', () => {
  it('tracks continue transitions and resets after a rejected request', () => {
    const state = new DebugSessionState<{ id: string }>();

    expectLib.expect(state.isContinuing()).toBe(false);
    state.updateContinuingState(true);
    expectLib.expect(state.isContinuing()).toBe(true);
    state.updateContinuingState(false);
    expectLib.expect(state.isContinuing()).toBe(false);
  });

  it('sets debug input response state and clears it on continue or completion', () => {
    const state = new DebugSessionState<{ id: string }>();
    const response = { id: 'debug-input' };

    state.updateDebugResponse(response);
    expectLib.expect(state.getDebugResponse()).toBe(response);
    state.updateDebugResponse(undefined);
    expectLib.expect(state.getDebugResponse()).toBeUndefined();
  });

  it('synchronizes valid NREPL responses and clears shared state on completion', () => {
    const state = new DebugSessionState<{ id: string }>();
    let shared: { id: string } | undefined;
    const update = (response: { id: string } | undefined) =>
      synchronizeDebugResponse(
        response,
        (value) => state.updateDebugResponse(value),
        (value) => (shared = value)
      );

    const response = { id: 'nrepl-debug-response' };
    update(response);
    expectLib.expect(state.getDebugResponse()).toBe(response);
    expectLib.expect(shared).toBe(response);

    const handled = handleNreplDebugCompletion(
      false,
      true,
      true,
      () => state.updateContinuingState(false),
      () => update(undefined),
      () => undefined
    );
    expectLib.expect(handled).toBe(true);
    expectLib.expect(state.getDebugResponse()).toBeUndefined();
    expectLib.expect(shared).toBeUndefined();
  });

  it('does not clear debug response for non-completion NREPL messages', () => {
    const calls: string[] = [];
    const handled = handleNreplDebugCompletion(
      false,
      false,
      true,
      () => calls.push('continue'),
      () => calls.push('response'),
      () => calls.push('terminated')
    );
    expectLib.expect(handled).toBe(false);
    expectLib.expect(calls).toEqual([]);
  });
});
