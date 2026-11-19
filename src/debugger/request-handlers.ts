import type { DebugProtocol } from '@vscode/debugprotocol';

export function handleRestartRequest(
  response: DebugProtocol.RestartResponse,
  sendResponse: (response: DebugProtocol.RestartResponse) => void
): void {
  response.success = false;
  sendResponse(response);
}
