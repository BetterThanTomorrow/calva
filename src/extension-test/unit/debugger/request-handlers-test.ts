import * as expectLib from 'expect';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { DebugRequestAdapter } from '../../../../src/debugger/debug-request-adapter';

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

  it('answers restart with a failed response, leaving the paused evaluation alone', () => {
    const response = {} as DebugProtocol.RestartResponse;
    const sent: DebugProtocol.RestartResponse[] = [];

    DebugRequestAdapter.restartRequest(response, (result) => sent.push(result));

    expectLib.expect(sent).toEqual([{ success: false }]);
  });
});
