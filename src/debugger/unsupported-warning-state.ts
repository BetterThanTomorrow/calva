export class UnsupportedWarningState<TSession extends object> {
  private lastSession: TSession | undefined;
  private lastMissingOperations: string | undefined;

  shouldWarn(session: TSession | undefined, missingOperations: string): boolean {
    if (this.lastSession === session && this.lastMissingOperations === missingOperations) {
      return false;
    }
    this.lastSession = session;
    this.lastMissingOperations = missingOperations;
    return true;
  }

  clear(session: TSession): void {
    if (this.lastSession === session) {
      this.lastSession = undefined;
      this.lastMissingOperations = undefined;
    }
  }
}
