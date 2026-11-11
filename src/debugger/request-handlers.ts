import type { DebugProtocol } from '@vscode/debugprotocol';
import { RESTART_UNAVAILABLE_MESSAGE } from './breakpoint-response';
import { reportDebugRequestFailure } from './debug-request-failure';

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
  response.message = RESTART_UNAVAILABLE_MESSAGE;
  sendResponse(response);
}

export function handleDebugInputRequest(
  request: PromiseLike<unknown>,
  onSuccess: () => void,
  onFailure: (error: unknown) => void
): void {
  void Promise.resolve(request).then(onSuccess).catch(onFailure);
}

export function handleContinueDebugInputRequest(
  request: PromiseLike<unknown>,
  resetContinuing: () => void,
  logError: (message: string, error: unknown) => void,
  showErrorMessage: (message: string) => void
): void {
  handleDebugInputRequest(
    request,
    () => undefined,
    (error) => {
      reportDebugRequestFailure('continue execution', error, logError, showErrorMessage);
      resetContinuing();
    }
  );
}

export function handleStepDebugInputRequest(
  request: PromiseLike<unknown>,
  onStopped: () => void,
  operation: 'step in' | 'step out',
  logError: (message: string, error: unknown) => void,
  showErrorMessage: (message: string) => void
): void {
  handleDebugInputRequest(request, onStopped, (error) =>
    reportDebugRequestFailure(operation, error, logError, showErrorMessage)
  );
}

export function handleDebugCompletion(
  clearContinuing: () => void,
  clearDebugResponse: () => void,
  sendTerminatedEvent: () => void
): void {
  clearContinuing();
  clearDebugResponse();
  sendTerminatedEvent();
}

export function handleNreplDebugCompletion(
  hasNeedDebugInputStatus: boolean,
  hasResult: boolean,
  hasActiveDebugSession: boolean,
  clearContinuing: () => void,
  clearDebugResponse: () => void,
  sendTerminatedEvent: () => void
): boolean {
  if (hasNeedDebugInputStatus || !hasResult || !hasActiveDebugSession) {
    return false;
  }
  handleDebugCompletion(clearContinuing, clearDebugResponse, sendTerminatedEvent);
  return true;
}
