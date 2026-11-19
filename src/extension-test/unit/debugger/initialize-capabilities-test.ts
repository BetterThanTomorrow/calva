import * as expectLib from 'expect';
import { sendInitializeResponse } from '../../../../src/debugger/initialize-capabilities';
import type * as debugProtocol from '@vscode/debugprotocol';

describe('debugger initialize capabilities', () => {
  it('advertises Step In, Step Out and Restart as supported', () => {
    const response: { body?: Partial<debugProtocol.DebugProtocol.Capabilities> } = {
      body: { supportsConfigurationDoneRequest: true },
    };
    let responseBody: typeof response.body;

    sendInitializeResponse(response, (initializeResponse) => {
      responseBody = initializeResponse.body;
    });

    expectLib.expect(responseBody).toMatchObject({
      supportsStepInRequest: true,
      supportsStepOutRequest: true,
      supportsRestartRequest: true,
      supportsConfigurationDoneRequest: true,
      supportsConditionalBreakpoints: true,
      supportsBreakpointLocationsRequest: true,
    });
  });
});
