import type { DebugProtocol } from '@vscode/debugprotocol';

export const COMMENT_BREAKPOINT_MESSAGE =
  'Breakpoints cannot be set on comments or commented-out code.';
export const RESTART_UNAVAILABLE_MESSAGE =
  'Restart is not available in Calva. Use Continue to resume execution.';

function breakpointMessage(
  isSupported: boolean,
  onComment: boolean,
  unsupportedMessage: () => string
): string | undefined {
  if (!isSupported) {
    return unsupportedMessage();
  }
  if (onComment) {
    return COMMENT_BREAKPOINT_MESSAGE;
  }
  return undefined;
}

function buildBreakpoint(
  breakpoint: DebugProtocol.SourceBreakpoint,
  isSupported: boolean,
  isOnComment: (breakpoint: DebugProtocol.SourceBreakpoint) => boolean,
  unsupportedMessage: () => string
): DebugProtocol.Breakpoint {
  const onComment = isSupported && isOnComment(breakpoint);
  const message = breakpointMessage(isSupported, onComment, unsupportedMessage);
  return {
    verified: isSupported && !onComment,
    ...(message ? { message } : {}),
    line: breakpoint.line,
    column: breakpoint.column,
  };
}

export function buildBreakpointResponse(
  breakpoints: DebugProtocol.SourceBreakpoint[],
  isSupported: boolean,
  isOnComment: (breakpoint: DebugProtocol.SourceBreakpoint) => boolean,
  unsupportedMessage: () => string
): DebugProtocol.Breakpoint[] {
  return breakpoints.map((breakpoint) =>
    buildBreakpoint(breakpoint, isSupported, isOnComment, unsupportedMessage)
  );
}
