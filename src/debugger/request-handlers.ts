import type { DebugProtocol } from '@vscode/debugprotocol';

export async function handleBreakpointLocationsRequest<TDocument>(
  response: DebugProtocol.BreakpointLocationsResponse,
  sourcePath: string | undefined,
  openDocument: (sourcePath: string) => PromiseLike<TDocument>,
  resolveLocations: (document: TDocument) => DebugProtocol.BreakpointLocation[],
  sendResponse: (response: DebugProtocol.BreakpointLocationsResponse) => void
): Promise<void> {
  if (!sourcePath) {
    response.body = { breakpoints: [] };
    sendResponse(response);
    return;
  }
  try {
    const document = await Promise.resolve(openDocument(sourcePath));
    response.body = { breakpoints: resolveLocations(document) };
  } catch (error) {
    response.success = false;
    response.message = `Could not open breakpoint source: ${String(error)}`;
  }
  sendResponse(response);
}

export function handleRestartRequest(
  response: DebugProtocol.RestartResponse,
  sendResponse: (response: DebugProtocol.RestartResponse) => void
): void {
  response.success = false;
  sendResponse(response);
}
