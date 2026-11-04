import * as expectLib from 'expect';
import { sendInitializeResponse } from '../../../../src/debugger/initialize-capabilities';
import type * as debugProtocol from '@vscode/debugprotocol';

describe('debugger initialize capabilities', () => {
  it('advertises Step In and Step Out as supported', () => {
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
      supportsConfigurationDoneRequest: true,
      supportsConditionalBreakpoints: true,
      supportsBreakpointLocationsRequest: true,
    });
  });
});
