import * as vscode from 'vscode';
import * as sessionRegistry from '../nrepl/session-registry';
import type * as nrepl from '../nrepl';
import {
  breakpointInsertions,
  codeWithBreakpoints,
  type SourceBreakpointData,
} from './breakpoint-targets';
import { canDebug, formatBreakpointsLeftOutMessage } from './debugger-ops';

/**
 * VS Code fills the extension host's breakpoint list on its first read, and the list
 * arrives later. Reading it early lets the first evaluation in a window see the
 * breakpoints restored from the last session.
 */
export function requestSourceBreakpoints(): void {
  void vscode.debug.breakpoints;
}

/** The warning about a session without the debugger shows once per VS Code window. */
let hasWarnedAboutMissingDebugger = false;

function sourceBreakpointData(breakpoint: vscode.SourceBreakpoint): SourceBreakpointData {
  const { line, character } = breakpoint.location.range.start;
  const { enabled, condition, logMessage, hitCondition } = breakpoint;
  return { line, character, enabled, condition, logMessage, hitCondition };
}

function documentSourceBreakpoints(document: vscode.TextDocument): SourceBreakpointData[] {
  const uri = document.uri.toString();
  return vscode.debug.breakpoints
    .filter(
      (breakpoint): breakpoint is vscode.SourceBreakpoint =>
        breakpoint instanceof vscode.SourceBreakpoint && breakpoint.location.uri.toString() === uri
    )
    .map(sourceBreakpointData);
}

function warnAboutMissingDebuggerOnce(session?: nrepl.NReplSession): void {
  if (hasWarnedAboutMissingDebugger) {
    return;
  }
  hasWarnedAboutMissingDebugger = true;
  const sessionKey = sessionRegistry.resolveSessionKey(session, 'current');
  void vscode.window.showWarningMessage(
    formatBreakpointsLeftOutMessage(sessionKey, session?.replType === 'cljs')
  );
}

/**
 * The code to send when evaluating `code`, which starts at `codeStart` in `document`:
 * with `#break` for the document's gutter breakpoints when `session` can debug.
 * When it can't, the code goes as it is, and Calva warns once per window.
 */
export function codeWithSourceBreakpoints(
  document: vscode.TextDocument,
  codeStart: number,
  code: string,
  session?: nrepl.NReplSession
): string {
  const breakpoints = documentSourceBreakpoints(document);
  if (breakpoints.length === 0) {
    return code;
  }
  const input = {
    documentText: document.getText(),
    codeStart,
    code,
    breakpoints,
    canDebug: canDebug(session),
  };
  if (!input.canDebug && breakpointInsertions(input).length > 0) {
    warnAboutMissingDebuggerOnce(session);
  }
  return codeWithBreakpoints(input);
}
