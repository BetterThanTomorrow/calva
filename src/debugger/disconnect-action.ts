export interface DebugInputSession {
  sendDebugInput(input: string, debugResponseId: string, debugResponseKey: string): Promise<unknown>;
}

/** End the DAP session before asking nREPL to advance to the next form. */
export function advanceAfterDisconnect(
  session: DebugInputSession,
  id: string,
  key: string,
  sendResponse: () => void,
  onError: (error: unknown) => void
): void {
  sendResponse();
  setTimeout(() => {
    void session.sendDebugInput(':next', id, key).catch(onError);
  }, 0);
}
