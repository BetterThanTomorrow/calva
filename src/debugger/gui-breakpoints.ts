import * as vscode from 'vscode';
import * as docMirror from '../doc-mirror/index';
import * as util from '../utilities';
import * as namespace from '../namespace';
import * as getText from '../util/get-text';
import * as replSession from '../nrepl/repl-session';
import * as sessionRegistry from '../nrepl/session-registry';
import * as sessionEvents from '../nrepl/session-events';
import * as debugDecorations from './decorations';
import { reconcileDebuggerSession } from './session-lifecycle';
import type * as nrepl from '../nrepl';
import {
  reconcileBreakpointLocations,
  affectedBreakpointLocations,
  enabledBreakpoints,
  updateBreakpointEnabledState,
  type BreakpointLocation,
} from './source-breakpoint-sync';
import { insertBreakpointForms } from './breakpoint-encoding';
import {
  instrumentSourceCodeWhenSupported,
  isClojureFamilySourcePath,
  supportsDebuggerOps,
} from './debugger-ops';

export type BreakpointCodeEvaluator = (
  code: string,
  options: BreakpointEvaluationOptions,
  selection?: vscode.Selection
) => Promise<string | null>;
type BreakpointEvaluationOptions = {
  filePath: string;
  line: number;
  column: number;
  ns: string;
  nsForm: string;
  session: nrepl.NReplSession;
  pprintOptions: { enabled: boolean };
};
type DocumentTokenCursor = ReturnType<ReturnType<typeof docMirror.getDocument>['getTokenCursor']>;
let breakpointCodeEvaluator: BreakpointCodeEvaluator | undefined;
const previousBreakpointLocations = new Map<string, BreakpointLocation>();
const breakpointEnabledById = new Map<string, boolean>();
let breakpointReconciliation = Promise.resolve();
let warnUnsupported: (session?: nrepl.NReplSession) => void = () => undefined;

export function configureGuiBreakpointDebugger(callbacks: {
  warnUnsupported: (session?: nrepl.NReplSession) => void;
}): void {
  warnUnsupported = callbacks.warnUnsupported;
}

function shouldReconcileDebuggerSession(eventType: string): boolean {
  return new Set([
    'session-added',
    'session-removed',
    'connection-added',
    'connection-removed',
    'session-renamed',
  ]).has(eventType);
}

function isClojureSourceBreakpoint(
  breakpoint: vscode.Breakpoint
): breakpoint is vscode.SourceBreakpoint {
  return (
    breakpoint instanceof vscode.SourceBreakpoint &&
    breakpoint.location.uri.scheme === 'file' &&
    isClojureFamilySourcePath(breakpoint.location.uri.path)
  );
}
function existingClojureSourceBreakpoints(): vscode.SourceBreakpoint[] {
  const snapshot = vscode.debug.breakpoints.filter(isClojureSourceBreakpoint);
  return enabledBreakpoints(snapshot, breakpointEnabledById);
}
export function breakpointLocationsForRange(
  document: vscode.TextDocument,
  range: vscode.Range
): vscode.Location[] {
  const start = document.offsetAt(range.start);
  const end = document.offsetAt(range.end);
  return listFormOffsetsForRange(document, start, end).map(
    (offset) =>
      new vscode.Location(
        document.uri,
        new vscode.Range(document.positionAt(offset), formEndPosition(document, offset))
      )
  );
}

function formEndPosition(document: vscode.TextDocument, formStartOffset: number): vscode.Position {
  const tokenCursor = docMirror.getDocument(document).getTokenCursor(formStartOffset);
  const [, formEnd] = tokenCursor.rangeForCurrentForm(formStartOffset);
  return document.positionAt(formEnd);
}

function listFormOffsetsForRange(
  document: vscode.TextDocument,
  startOffset: number,
  endOffset: number
): number[] {
  const mirrorDocument = docMirror.getDocument(document);
  const offsets: number[] = [];
  const seen = new Set<number>();

  for (let offset = startOffset; offset <= endOffset; offset++) {
    const tokenCursor = mirrorDocument.getTokenCursor(offset);
    if (!isListOpeningAtOffset(tokenCursor, offset)) {
      continue;
    }

    const [formStart] = tokenCursor.rangeForCurrentForm(offset);
    if (!isNewFormOffset(formStart, startOffset, endOffset, seen)) {
      continue;
    }

    seen.add(formStart);
    offsets.push(formStart);
  }

  return offsets;
}

function isListOpeningAtOffset(tokenCursor: DocumentTokenCursor, offset: number): boolean {
  const token = tokenCursor.getToken();
  return tokenCursor.offsetStart === offset && token.type === 'open' && token.raw.endsWith('(');
}

function isNewFormOffset(
  formStart: number,
  startOffset: number,
  endOffset: number,
  seen: Set<number>
): boolean {
  return formStart >= startOffset && formStart <= endOffset && !seen.has(formStart);
}

function lineBreakpointTargetOffset(
  document: vscode.TextDocument,
  position: vscode.Position
): number {
  const line = document.lineAt(position.line);
  const lineStartOffset = document.offsetAt(line.range.start);
  const lineEndOffset = document.offsetAt(line.range.end);
  const listFormOffsets = listFormOffsetsForRange(document, lineStartOffset, lineEndOffset);

  if (listFormOffsets.length > 0) {
    return listFormOffsets[listFormOffsets.length - 1];
  }

  return document.offsetAt(
    new vscode.Position(line.lineNumber, line.firstNonWhitespaceCharacterIndex)
  );
}

function positionedBreakpointTargetOffset(
  document: vscode.TextDocument,
  position: vscode.Position
): number {
  const offset = document.offsetAt(position);
  const tokenCursor = docMirror.getDocument(document).getTokenCursor(offset);

  const enclosingList = tokenCursor.rangeForList(1);
  if (isOpeningTokenAtOffset(tokenCursor, offset)) {
    return offset;
  }
  return enclosingList?.[0] ?? positionedFormStart(tokenCursor, offset);
}

function isOpeningTokenAtOffset(tokenCursor: DocumentTokenCursor, offset: number): boolean {
  return tokenCursor.offsetStart === offset && tokenCursor.getToken().type === 'open';
}

function positionedFormStart(tokenCursor: DocumentTokenCursor, offset: number): number {
  return tokenCursor.backwardFunction()
    ? tokenCursor.offsetStart
    : tokenCursor.rangeForCurrentForm(offset)[0];
}

function breakpointTargetOffset(
  document: vscode.TextDocument,
  breakpoint: vscode.SourceBreakpoint
): number {
  const position = breakpoint.location.range.start;
  const line = document.lineAt(position.line);

  return position.character <= line.firstNonWhitespaceCharacterIndex
    ? lineBreakpointTargetOffset(document, position)
    : positionedBreakpointTargetOffset(document, position);
}

export function breakpointTargetPosition(
  document: vscode.TextDocument,
  breakpoint: vscode.SourceBreakpoint
): vscode.Position {
  return document.positionAt(breakpointTargetOffset(document, breakpoint));
}

export function breakpointPositionIsInComment(
  document: vscode.TextDocument,
  position: vscode.Position
): boolean {
  return docMirror
    .getDocument(document)
    .getTokenCursor(document.offsetAt(position))
    .withinComment();
}

function injectBreakpoints(
  document: vscode.TextDocument,
  selection: vscode.Selection,
  code: string,
  breakpoints: vscode.SourceBreakpoint[]
): string {
  const selectionStartOffset = document.offsetAt(selection.start);
  return insertBreakpointForms(
    code,
    breakpoints.map((breakpoint) => ({
      offset: breakpointTargetOffset(document, breakpoint) - selectionStartOffset,
      condition: breakpoint.condition,
    }))
  );
}

function sourceBreakpointsForSelection(
  document: vscode.TextDocument,
  selection: vscode.Selection,
  sourceBreakpoints: readonly vscode.SourceBreakpoint[]
): vscode.SourceBreakpoint[] {
  return enabledBreakpoints(
    sourceBreakpoints.filter(isClojureSourceBreakpoint),
    breakpointEnabledById
  )
    .filter(
      (breakpoint) => !breakpointPositionIsInComment(document, breakpoint.location.range.start)
    )
    .filter(
      (breakpoint) =>
        breakpoint.location.uri.toString() === document.uri.toString() &&
        selection.contains(breakpointTargetPosition(document, breakpoint))
    );
}

export function instrumentCodeWithSourceBreakpoints(
  document: vscode.TextDocument,
  selection: vscode.Selection,
  code: string,
  session?: nrepl.NReplSession,
  sourceBreakpoints: readonly vscode.SourceBreakpoint[] = existingClojureSourceBreakpoints()
): string {
  const breakpoints = sourceBreakpointsForSelection(document, selection, sourceBreakpoints);
  if (breakpoints.length > 0 && !supportsDebuggerOps(session)) {
    warnUnsupported(session);
  }

  return instrumentSourceCodeWhenSupported(code, session, breakpoints.length > 0, (source) =>
    injectBreakpoints(document, selection, source, breakpoints)
  );
}

async function evaluateTopLevelFormForBreakpoint(
  document: vscode.TextDocument,
  position: vscode.Position,
  sourceBreakpoints: readonly vscode.SourceBreakpoint[] = existingClojureSourceBreakpoints()
): Promise<void> {
  const session = getBreakpointEvaluationSession(document);
  if (!session) {
    return;
  }
  const [selection, code] = getText.currentTopLevelFormText(document, position);
  if (!selection || code.length === 0) {
    return;
  }
  await evaluateBreakpointForm(document, selection, code, session, sourceBreakpoints);
}

function getBreakpointEvaluationSession(
  document: vscode.TextDocument
): nrepl.NReplSession | undefined {
  if (!util.getConnectedState()) {
    return undefined;
  }
  const session = replSession.getSession(document);
  if (!session) {
    return undefined;
  }
  if (!supportsDebuggerOps(session)) {
    warnUnsupported(session);
  }
  return session;
}

async function evaluateBreakpointForm(
  document: vscode.TextDocument,
  selection: vscode.Selection,
  code: string,
  session: nrepl.NReplSession,
  sourceBreakpoints: readonly vscode.SourceBreakpoint[] = existingClojureSourceBreakpoints()
): Promise<void> {
  const [ns, nsForm] = namespace.getNamespace(document, selection.end);
  const codeToEvaluate = instrumentCodeWithSourceBreakpoints(
    document,
    selection,
    code,
    session,
    sourceBreakpoints
  );

  try {
    await evaluateBreakpointCode(document, selection, codeToEvaluate, ns, nsForm, session);
    debugDecorations.triggerUpdateAndRenderDecorations();
  } catch (e) {
    void vscode.window.showWarningMessage(`Failed instrumenting breakpoint: ${e.message ?? e}`);
  }
}

async function evaluateBreakpointCode(
  document: vscode.TextDocument,
  selection: vscode.Selection,
  code: string,
  ns: string,
  nsForm: string,
  session: nrepl.NReplSession
): Promise<void> {
  if (breakpointCodeEvaluator) {
    await breakpointCodeEvaluator(
      code,
      {
        filePath: document.fileName,
        line: selection.start.line,
        column: selection.start.character,
        ns,
        nsForm,
        session,
        pprintOptions: { enabled: false },
      },
      selection
    );
    return;
  }
  await session.evaluateInNs(nsForm, ns);
  await session.eval(code, ns, {
    file: document.fileName,
    line: selection.start.line + 1,
    column: selection.start.character + 1,
    pprintOptions: { enabled: false },
  }).value;
}

function breakpointLocation(breakpoint: vscode.SourceBreakpoint): BreakpointLocation {
  return {
    uri: breakpoint.location.uri.toString(),
    line: breakpoint.location.range.start.line,
    character: breakpoint.location.range.start.character,
  };
}

function rememberBreakpointLocations(): void {
  for (const breakpoint of existingClojureSourceBreakpoints()) {
    previousBreakpointLocations.set(breakpoint.id, breakpointLocation(breakpoint));
  }
}

function syncChangedSourceBreakpoints(event: vscode.BreakpointsChangeEvent): void {
  const sourceEvent = {
    ...event,
    added: event.added.filter(isClojureSourceBreakpoint),
    changed: event.changed.filter(isClojureSourceBreakpoint),
    removed: event.removed.filter(isClojureSourceBreakpoint),
  };
  updateBreakpointEnabledState(sourceEvent, breakpointEnabledById, (breakpoint) => breakpoint.id);
  const affectedLocations = affectedBreakpointLocations(
    sourceEvent,
    previousBreakpointLocations,
    (breakpoint) => breakpoint.id,
    breakpointLocation,
    isClojureSourceBreakpoint
  );
  rememberBreakpointLocations();
  breakpointReconciliation = breakpointReconciliation
    .then(() => syncSourceBreakpointLocations(affectedLocations))
    .catch((error) => {
      console.error('Failed reconciling source breakpoints', error);
    });
}

async function syncSourceBreakpoints(breakpoints: vscode.SourceBreakpoint[]): Promise<void> {
  await syncSourceBreakpointLocations(breakpoints.map(breakpointLocation));
}

async function syncSourceBreakpointLocations(locations: BreakpointLocation[]): Promise<void> {
  await reconcileBreakpointLocations(
    locations,
    async (location) => {
      const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(location.uri));
      const position = new vscode.Position(location.line, location.character);
      if (breakpointPositionIsInComment(document, position)) {
        return undefined;
      }
      const [selection] = getText.currentTopLevelFormText(document, position);
      if (!selection) {
        return undefined;
      }
      const key = [
        document.uri.toString(),
        selection.start.line,
        selection.start.character,
        selection.end.line,
        selection.end.character,
      ].join(':');
      return { document, position, key };
    },
    (target) => target.key,
    existingClojureSourceBreakpoints,
    (target, breakpoints) =>
      evaluateTopLevelFormForBreakpoint(target.document, target.position, breakpoints),
    (error, phase) => {
      console.error(
        phase === 'resolve'
          ? 'Failed resolving source breakpoint target'
          : 'Failed evaluating source breakpoint target',
        error
      );
    }
  );
}

export function registerGuiSourceBreakpointInstrumentation(
  context: vscode.ExtensionContext,
  evaluator?: BreakpointCodeEvaluator
): void {
  breakpointCodeEvaluator = evaluator;
  rememberBreakpointLocations();
  updateBreakpointEnabledState(
    { added: existingClojureSourceBreakpoints(), changed: [], removed: [] },
    breakpointEnabledById,
    (breakpoint) => breakpoint.id
  );
  let activeDebuggerSession: nrepl.NReplSession | undefined;
  const reconcileActiveSession = () => {
    activeDebuggerSession = reconcileDebuggerSession(
      activeDebuggerSession,
      replSession.getSession(),
      {
        isSupported: supportsDebuggerOps,
        synchronizeBreakpoints: () => {
          void syncSourceBreakpoints(existingClojureSourceBreakpoints());
        },
      }
    );
  };
  context.subscriptions.push(
    sessionEvents.onSessionsChanged((event) => {
      if (shouldReconcileDebuggerSession(event.type)) {
        reconcileActiveSession();
      }
    }),
    vscode.window.onDidChangeActiveTextEditor(reconcileActiveSession)
  );
  reconcileActiveSession();
  context.subscriptions.push(vscode.debug.onDidChangeBreakpoints(syncChangedSourceBreakpoints));
}
