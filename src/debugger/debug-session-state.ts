export class DebugSessionState<T> {
  private continuing = false;
  private debugResponse?: T;

  isContinuing(): boolean {
    return this.continuing;
  }

  updateContinuingState(isContinuing: boolean): void {
    this.continuing = isContinuing;
  }

  getDebugResponse(): T | undefined {
    return this.debugResponse;
  }

  updateDebugResponse(response: T | undefined): void {
    this.debugResponse = response;
  }
}

export function synchronizeDebugResponse<T>(
  response: T | undefined,
  updateLocal: (response: T | undefined) => void,
  updateShared: (response: T | undefined) => void
): void {
  updateLocal(response);
  updateShared(response);
}
