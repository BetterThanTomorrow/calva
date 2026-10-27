import * as vscode from 'vscode';
import * as docMirror from '../doc-mirror/index';
import * as util from '../utilities';
import * as namespace from '../namespace';
import * as getText from '../util/get-text';
import * as replSession from '../nrepl/repl-session';
import * as sessionRegistry from '../nrepl/session-registry';
import * as sessionEvents from '../nrepl/session-events';
import * as sessionRouting from '../nrepl/session-routing';
import * as debugDecorations from './decorations';
import * as debugUtil from './util';
import { reconcileDebuggerSession } from './session-lifecycle';
import type * as nrepl from '../nrepl';
import {
  reconcileBreakpointLocations,
  affectedBreakpointLocations,
  type BreakpointLocation,
} from './source-breakpoint-sync';
import {
  insertBreakpointForms,
  insertDebugScopes,
  isBreakpointSupported,
  offsetAfterDebugScopes,
  type DebugScopeInsertion,
} from './breakpoint-encoding';
import {
  instrumentSourceCodeWhenSupported,
  isClojureFamilySourcePath,
  supportsDebuggerOps,
} from './debugger-ops';
import { shouldExposeSourceBreakpointStop } from './source-breakpoint-stop';

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
let sourceBreakpointStepTargets:
  | { file: string; formStart: number; endOffset: number }[]
  | undefined;
const previousBreakpointLocations = new WeakMap<vscode.SourceBreakpoint, BreakpointLocation>();
let breakpointReconciliation = Promise.resolve();
let warnUnsupported: (session?: nrepl.NReplSession) => void = () => undefined;
let initializeDebugger: (session: nrepl.NReplSession) => void = () => undefined;

export function guiBreakpointStepTargets():
  | readonly { file: string; formStart: number; endOffset: number }[]
  | undefined {
  return sourceBreakpointStepTargets;
}

export async function shouldExposeGuiBreakpointStop(response: {
  file: string;
  line: number;
  column: number;
}): Promise<boolean> {
  try {
    const targets = guiBreakpointStepTargets();
    if (!targets?.length) {
      return true;
    }
    const uri = sourceLocationUri(response.file);
    const document = await vscode.workspace.openTextDocument(uri);
    const offset = document.offsetAt(
      new vscode.Position(oneBasedToZeroBased(response.line), oneBasedToZeroBased(response.column))
    );
    const cursor = docMirror.getDocument(document).getTokenCursor(offset);
    const responseFormRange = cursor.rangeForDefun(offset);
    debugUtil.moveTokenCursorToBreakpoint(cursor, response);
    return shouldExposeSourceBreakpointStop(
      targets.map((target) => ({ ...target, file: vscode.Uri.file(target.file).toString() })),
      uri.toString(),
      responseFormRange?.[0],
      cursor.offsetStart
    );
  } catch (error) {
    console.error(
      'Calva debugger: could not map an auto-step location to the GUI breakpoint',
      error
    );
    // If source mapping fails, expose the stop so the debugger does not hide a
    // legitimate pause indefinitely.
    return true;
  }
}

function sourceLocationUri(file: string): vscode.Uri {
  return file.startsWith('jar:') || file.startsWith('file:')
    ? vscode.Uri.parse(file)
    : vscode.Uri.file(file);
}

function oneBasedToZeroBased(n: number): number {
  return Math.max(0, n - 1);
}
export function configureGuiBreakpointDebugger(callbacks: {
  warnUnsupported: (session?: nrepl.NReplSession) => void;
  initializeDebugger: (session: nrepl.NReplSession) => void;
}): void {
  warnUnsupported = callbacks.warnUnsupported;
  initializeDebugger = callbacks.initializeDebugger;
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
  return vscode.debug.breakpoints.filter(isClojureSourceBreakpoint);
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

/**
 * Return the body expression range for a simple, single-expression defn/defn-
 * containing the breakpoint. Prefixing the body expression with #dbg leaves
 * the read form's shape intact, so cider-nrepl coordinates still map to source.
 */
function functionBodyRangeForBreakpoint(
  document: vscode.TextDocument,
  targetOffset: number
): [number, number] | undefined {
  const defunRange = docMirror
    .getDocument(document)
    .getTokenCursor(targetOffset)
    .rangeForDefun(targetOffset);
  return defunRange
    ? functionBodyRangeWithinDefn(document, defunRange[0], defunRange[1], targetOffset)
    : undefined;
}

function functionBodyRangeWithinDefn(
  document: vscode.TextDocument,
  formStart: number,
  formEnd: number,
  targetOffset: number
): [number, number] | undefined {
  const formHead = document
    .getText(new vscode.Range(document.positionAt(formStart), document.positionAt(formEnd)))
    .trimStart()
    .match(/^\(\s*(defn-?)\b/);
  if (!formHead) {
    return undefined;
  }
  const cursor = docMirror.getDocument(document).getTokenCursor(formStart);
  if (!advanceCursorToFunctionBody(cursor)) {
    return undefined;
  }

  // Only handle the common single-arity, single-body-expression shape. Other
  // function forms keep their existing #break-only behavior.
  const bodyStart = cursor.offsetStart;
  const bodyEnd = formEnd - 1; // the defn's closing parenthesis
  const isSingleBody = hasSingleBodyExpression(cursor);
  return isTargetWithinSingleBody(isSingleBody, bodyStart, bodyEnd, targetOffset)
    ? [bodyStart, bodyEnd]
    : undefined;
}

function isTargetWithinSingleBody(
  isSingleBody: boolean,
  bodyStart: number,
  bodyEnd: number,
  targetOffset: number
): boolean {
  return isSingleBody && bodyStart <= targetOffset && targetOffset < bodyEnd;
}

function advanceCursorToFunctionBody(cursor: DocumentTokenCursor): boolean {
  cursor.next();
  cursor.forwardWhitespace();
  cursor.forwardSexp(); // defn / defn-
  cursor.forwardWhitespace();
  cursor.forwardSexp(); // function name
  cursor.forwardWhitespace();
  skipOptionalDefnMetadata(cursor);
  if (cursor.getToken().raw !== '[') {
    return false;
  }
  cursor.forwardSexp(); // argument vector
  cursor.forwardWhitespace();
  return true;
}

function skipOptionalDefnMetadata(cursor: DocumentTokenCursor): void {
  const token = cursor.getToken();
  if (token.raw.startsWith('"') || token.type === 'lit') {
    cursor.forwardSexp();
    cursor.forwardWhitespace();
  }
  if (cursor.getToken().raw === '{') {
    cursor.forwardSexp();
    cursor.forwardWhitespace();
  }
}

function hasSingleBodyExpression(cursor: DocumentTokenCursor): boolean {
  if (!cursor.forwardSexp()) {
    return false;
  }
  cursor.forwardWhitespace();
  return cursor.getToken().type === 'close';
}

function injectBreakpoints(
  document: vscode.TextDocument,
  selection: vscode.Selection,
  code: string,
  breakpoints: vscode.SourceBreakpoint[]
): string {
  const selectionStartOffset = document.offsetAt(selection.start);
  const absoluteTargets = breakpoints.map((breakpoint) =>
    breakpointTargetOffset(document, breakpoint)
  );
  const scopeRanges = absoluteTargets
    .map((offset) => functionBodyRangeForBreakpoint(document, offset))
    .filter((range): range is [number, number] => range !== undefined);
  const uniqueScopes = [...new Map(scopeRanges.map((range) => [range.join(':'), range])).values()];
  const scopes: DebugScopeInsertion[] = uniqueScopes
    .map(([start, end]) => ({
      start: start - selectionStartOffset,
      end: end - selectionStartOffset,
    }))
    .filter((scope) => scope.start >= 0 && scope.end <= code.length);

  // Remember the actual target forms. The adapter uses these locations to
  // auto-step through the synthetic #dbg stops until the gutter breakpoint is
  // reached, then presents that stop to VS Code.
  sourceBreakpointStepTargets = absoluteTargets.flatMap((targetOffset) => {
    const cursor = docMirror.getDocument(document).getTokenCursor(targetOffset);
    const targetRange = cursor.rangeForCurrentForm(targetOffset);
    const formRange = cursor.rangeForDefun(targetOffset);
    return targetRange && formRange
      ? [{ file: document.fileName, formStart: formRange[0], endOffset: targetRange[1] }]
      : [];
  });

  const wrappedCode = insertDebugScopes(code, scopes);
  return insertBreakpointForms(
    wrappedCode,
    breakpoints.map((breakpoint) => {
      const originalOffset = breakpointTargetOffset(document, breakpoint) - selectionStartOffset;
      return {
        offset: offsetAfterDebugScopes(originalOffset, scopes),
        condition: breakpoint.condition,
      };
    })
  );
}

export function instrumentCodeWithSourceBreakpoints(
  document: vscode.TextDocument,
  selection: vscode.Selection,
  code: string,
  session?: nrepl.NReplSession,
  sourceBreakpoints: readonly vscode.SourceBreakpoint[] = existingClojureSourceBreakpoints()
): string {
  const breakpoints = sourceBreakpoints
    .filter(isClojureSourceBreakpoint)
    .filter(
      (breakpoint) =>
        breakpoint.location.uri.toString() === document.uri.toString() &&
        selection.contains(breakpointTargetPosition(document, breakpoint))
    );

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
  } else {
    initializeDebugger(session);
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
    previousBreakpointLocations.set(breakpoint, breakpointLocation(breakpoint));
  }
}

function syncChangedSourceBreakpoints(event: vscode.BreakpointsChangeEvent): void {
  const affectedLocations = affectedBreakpointLocations(
    event,
    previousBreakpointLocations,
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

export function registerSourceBreakpointInstrumentation(
  context: vscode.ExtensionContext,
  evaluator?: BreakpointCodeEvaluator
): void {
  breakpointCodeEvaluator = evaluator;
  rememberBreakpointLocations();
  let activeDebuggerSession: nrepl.NReplSession | undefined;
  const reconcileActiveSession = () => {
    activeDebuggerSession = reconcileDebuggerSession(
      activeDebuggerSession,
      replSession.getSession(),
      {
        isSupported: supportsDebuggerOps,
        initialize: initializeDebugger,
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
    sessionRouting.onDidChangeRouting(reconcileActiveSession),
    vscode.window.onDidChangeActiveTextEditor(reconcileActiveSession)
  );
  reconcileActiveSession();
  context.subscriptions.push(
    vscode.debug.onDidChangeBreakpoints((event) => {
      void syncChangedSourceBreakpoints(event);
    })
  );
}
