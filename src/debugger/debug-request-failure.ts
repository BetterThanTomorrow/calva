export function reportDebugRequestFailure(
  operation: string,
  error: unknown,
  logError: (message: string, error: unknown) => void,
  showErrorMessage: (message: string) => void
): void {
  const detail = error instanceof Error ? error.message : String(error);
  const message = `Calva debugger: failed to ${operation}: ${detail}`;
  logError(`Calva debugger: failed to ${operation}`, error);
  showErrorMessage(message);
}
