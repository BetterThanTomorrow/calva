import type { DebugProtocol } from '@vscode/debugprotocol';
import { handleBreakpointLocationsRequest, handleRestartRequest } from './request-handlers';

/** Request boundary shared by the VS Code adapter and focused request tests. */
export class DebugRequestAdapter<TDocument> {
  constructor(
    private readonly openDocument: (sourcePath: string) => PromiseLike<TDocument>,
    private readonly resolveLocations: (
      document: TDocument,
      args: DebugProtocol.BreakpointLocationsArguments
    ) => DebugProtocol.BreakpointLocation[],
    private readonly sendResponse: (
      response: DebugProtocol.BreakpointLocationsResponse | DebugProtocol.RestartResponse
    ) => void
  ) {}

  breakpointLocationsRequest(
    response: DebugProtocol.BreakpointLocationsResponse,
    args: DebugProtocol.BreakpointLocationsArguments
  ): Promise<void> {
    return handleBreakpointLocationsRequest(
      response,
      args.source.path,
      this.openDocument,
      (document) => this.resolveLocations(document, args),
      (result) => this.sendResponse(result)
    );
  }

  restartRequest(response: DebugProtocol.RestartResponse): void {
    handleRestartRequest(response, this.sendResponse);
  }

  static restartRequest(
    response: DebugProtocol.RestartResponse,
    sendResponse: (response: DebugProtocol.RestartResponse) => void
  ): void {
    handleRestartRequest(response, sendResponse);
  }
}
