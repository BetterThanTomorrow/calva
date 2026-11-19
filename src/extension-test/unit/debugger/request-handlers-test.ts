import * as expectLib from 'expect';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { handleRestartRequest } from '../../../../src/debugger/request-handlers';

describe('debug request handlers', () => {
  it('answers restart with a failed response, leaving the paused evaluation alone', () => {
    const response = {} as DebugProtocol.RestartResponse;
    const sent: DebugProtocol.RestartResponse[] = [];

    handleRestartRequest(response, (result) => sent.push(result));

    expectLib.expect(sent).toEqual([{ success: false }]);
  });
});
