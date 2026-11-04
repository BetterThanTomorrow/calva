import type * as debugProtocol from '@vscode/debugprotocol';

type InitializeCapabilities = Partial<debugProtocol.DebugProtocol.Capabilities> & {
  supportsStepInRequest: boolean;
  supportsStepOutRequest: boolean;
};

export type InitializeResponseBody = Partial<debugProtocol.DebugProtocol.Capabilities> &
  InitializeCapabilities;

const initializeCapabilities: InitializeCapabilities = {
  supportsStepInRequest: true,
  supportsStepOutRequest: true,
};

export function buildInitializeResponseBody(
  body?: Partial<debugProtocol.DebugProtocol.Capabilities>
): InitializeResponseBody {
  return {
    ...body,
    ...initializeCapabilities,
    supportsConditionalBreakpoints: true,
    supportsBreakpointLocationsRequest: true,
  };
}

export function sendInitializeResponse<
  T extends { body?: Partial<debugProtocol.DebugProtocol.Capabilities> }
>(response: T, sendResponse: (response: T) => void): void {
  response.body = buildInitializeResponseBody(response.body);
  sendResponse(response);
}
