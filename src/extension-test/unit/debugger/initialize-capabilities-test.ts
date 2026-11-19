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
    });
  });

  it('advertises neither breakpoint locations, logpoints nor hit counts', () => {
    const response: { body?: Partial<debugProtocol.DebugProtocol.Capabilities> } = {};
    let responseBody: typeof response.body;

    sendInitializeResponse(response, (initializeResponse) => {
      responseBody = initializeResponse.body;
    });

    expectLib.expect(responseBody.supportsBreakpointLocationsRequest).toBeUndefined();
    expectLib.expect(responseBody.supportsLogPoints).toBeUndefined();
    expectLib.expect(responseBody.supportsHitConditionalBreakpoints).toBeUndefined();
  });
});
