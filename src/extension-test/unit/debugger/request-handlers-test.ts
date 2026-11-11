import * as expectLib from 'expect';
import type { DebugProtocol } from '@vscode/debugprotocol';
import {
  handleContinueDebugInputRequest,
  handleDebugCompletion,
  handleStepDebugInputRequest,
} from '../../../../src/debugger/request-handlers';
import { DebugRequestAdapter } from '../../../../src/debugger/debug-request-adapter';
import { RESTART_UNAVAILABLE_MESSAGE } from '../../../../src/debugger/breakpoint-response';
import { DebugSessionState } from '../../../../src/debugger/debug-session-state';

describe('debug request handlers', () => {
  it('responds with no locations when the source path is missing', async () => {
    const response = {} as DebugProtocol.BreakpointLocationsResponse;
    const sent: Array<DebugProtocol.BreakpointLocationsResponse | DebugProtocol.RestartResponse> =
      [];
    let openCount = 0;

    await new DebugRequestAdapter(
      () => {
        openCount++;
        return Promise.resolve({});
      },
      () => [],
      (result) => sent.push(result)
    ).breakpointLocationsRequest(response, {
      source: {},
      line: 1,
    } as DebugProtocol.BreakpointLocationsArguments);

    expectLib.expect(response.body).toEqual({ breakpoints: [] });
    expectLib.expect(sent).toEqual([response]);
    expectLib.expect(openCount).toBe(0);
  });

  it('returns mapped locations for a valid source path', async () => {
    const response = {} as DebugProtocol.BreakpointLocationsResponse;
    const sent: Array<DebugProtocol.BreakpointLocationsResponse | DebugProtocol.RestartResponse> =
      [];
    const locations = [{ line: 3, column: 2, endLine: 3, endColumn: 7 }];

    await new DebugRequestAdapter(
      (sourcePath) => Promise.resolve({ sourcePath }),
      (document) => (document.sourcePath === '/sample.clj' ? locations : []),
      (result) => sent.push(result)
    ).breakpointLocationsRequest(response, {
      source: { path: '/sample.clj' },
      line: 1,
    } as DebugProtocol.BreakpointLocationsArguments);

    expectLib.expect(response.body).toEqual({ breakpoints: locations });
    expectLib.expect(sent).toEqual([response]);
  });

  it('sends a failed response when the breakpoint source cannot be opened', async () => {
    const response = {} as DebugProtocol.BreakpointLocationsResponse;
    const sent: Array<DebugProtocol.BreakpointLocationsResponse | DebugProtocol.RestartResponse> =
      [];

    await new DebugRequestAdapter(
      () => Promise.reject(new Error('file unavailable')),
      () => [],
      (result) => sent.push(result)
    ).breakpointLocationsRequest(response, {
      source: { path: '/missing.clj' },
      line: 1,
    } as DebugProtocol.BreakpointLocationsArguments);

    expectLib.expect(response.success).toBe(false);
    expectLib
      .expect(response.message)
      .toBe('Could not open breakpoint source: Error: file unavailable');
    expectLib.expect(sent).toEqual([response]);
  });

  it('sends the actual unavailable restart response', () => {
    const response = {} as DebugProtocol.RestartResponse;
    const sent: DebugProtocol.RestartResponse[] = [];

    DebugRequestAdapter.restartRequest(response, (result) => sent.push(result));

    expectLib.expect(sent).toEqual([{ success: false, message: RESTART_UNAVAILABLE_MESSAGE }]);
  });

  it('does not invoke the stopped callback when step input is rejected', async () => {
    for (const operation of ['step in', 'step out'] as const) {
      const shown: string[] = [];
      const logged: unknown[] = [];
      let stoppedEvents = 0;
      handleStepDebugInputRequest(
        Promise.reject(new Error(`${operation} rejected`)),
        () => stoppedEvents++,
        operation,
        (_message, detail) => logged.push(detail),
        (message) => shown.push(message)
      );
      await Promise.resolve();
      await Promise.resolve();
      expectLib.expect(stoppedEvents).toBe(0);
      expectLib.expect(logged).toEqual([new Error(`${operation} rejected`)]);
      expectLib
        .expect(shown)
        .toEqual([`Calva debugger: failed to ${operation}: ${operation} rejected`]);
    }
  });

  it('resets continuing state when continue input is rejected', async () => {
    const state = new DebugSessionState<unknown>();
    state.updateContinuingState(true);
    handleContinueDebugInputRequest(
      Promise.reject('rejected'),
      () => state.updateContinuingState(false),
      () => undefined,
      () => undefined
    );
    await Promise.resolve();
    await Promise.resolve();
    expectLib.expect(state.isContinuing()).toBe(false);
  });

  it('clears adapter state and synchronizes completion handling', () => {
    const calls: string[] = [];
    handleDebugCompletion(
      () => calls.push('clear continuing'),
      () => calls.push('clear debug response'),
      () => calls.push('send terminated event')
    );

    expectLib
      .expect(calls)
      .toEqual(['clear continuing', 'clear debug response', 'send terminated event']);
  });
});
