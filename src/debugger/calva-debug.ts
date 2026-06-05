import * as debugAdapter from '@vscode/debugadapter';
import * as debugProtocol from '@vscode/debugprotocol';
import * as Net from 'net';
import * as state from '../state';
import * as path from 'path';
import * as docMirror from '../doc-mirror/index';
import * as vscode from 'vscode';
import * as debugUtil from './util';
import * as annotations from '../providers/annotations';
import type * as nrepl from '../nrepl';
import * as debugDecorations from './decorations';
import * as cljsLib from '../../out/cljs-lib/cljs-lib';
import * as util from '../utilities';
import * as replSession from '../nrepl/repl-session';
import * as sessionRegistry from '../nrepl/session-registry';
import * as sessionRouting from '../nrepl/session-routing';
import * as TokenCursor from '../cursor-doc/token-cursor';
import * as cursorUtil from '../cursor-doc/utilities';
import * as getText from '../util/get-text';
import * as namespace from '../namespace';

const CALVA_DEBUG_CONFIGURATION: vscode.DebugConfiguration = {
  type: 'clojure',
  name: 'Calva Debug',
  request: 'attach',
};

const REQUESTS = {
  SEND_STOPPED_EVENT: 'send-stopped-event',
  SEND_TERMINATED_EVENT: 'send-terminated-event',
};

const NEED_DEBUG_INPUT_STATUS = 'need-debug-input';
const DEBUG_RESPONSE_KEY = 'debug-response';
const DEBUG_QUIT_VALUE = 'QUIT';
const DEBUGGER_OPS = ['init-debugger', 'debug-input'];
const DEBUG_ANALYTICS = {
  CATEGORY: 'Debugger',
  EVENT_ACTIONS: {
    ATTACH: 'Attach',
    CONTINUE: 'Continue',
    STEP_OVER: 'StepOver',
    STEP_IN: 'StepIn',
    STEP_OUT: 'StepOut',
    INSTRUMENT_FORM: 'InstrumentForm',
    EVALUATE_IN_DEBUG_CONTEXT: 'EvaluateInDebugContext',
  },
};

type ExtractedStructure = {
  structure: any[];
  originalStrings: string[];
};

type BreakpointCodeEvaluator = (
  code: string,
  options: any,
  selection?: vscode.Selection
) => Promise<string | null>;

let breakpointCodeEvaluator: BreakpointCodeEvaluator | undefined;
let warnedUnsupportedSessionKeys = new Set<string>();

class CalvaDebugSession extends debugAdapter.LoggingDebugSession {
  // We don't support multiple threads, so we can use a hardcoded ID for the default thread
  static THREAD_ID = 1;

  private _variableHandles = new debugAdapter.Handles<string>();
  private _variableStructures: { [id: string]: any } = {};

  public constructor() {
    super('calva-debug-logs.txt');
  }

  /**
   * The 'initialize' request is the first request called by the frontend
   * to interrogate the features the debug adapter provides.
   */
  protected initializeRequest(
    response: debugProtocol.DebugProtocol.InitializeResponse,
    args: debugProtocol.DebugProtocol.InitializeRequestArguments
  ): void {
    this.setDebuggerLinesStartAt1(args.linesStartAt1);
    this.setDebuggerColumnsStartAt1(args.columnsStartAt1);

    // Build and return the capabilities of this debug adapter
    response.body = {
      ...response.body,
      supportsRestartRequest: true,
      supportsConditionalBreakpoints: true,
      supportsBreakpointLocationsRequest: true,
    };

    this.sendResponse(response);
  }

  protected breakpointLocationsRequest(
    response: debugProtocol.DebugProtocol.BreakpointLocationsResponse,
    args: debugProtocol.DebugProtocol.BreakpointLocationsArguments,
    request?: debugProtocol.DebugProtocol.Request
  ): void {
    void this.resolveBreakpointLocations(response, args);
  }

  private async resolveBreakpointLocations(
    response: debugProtocol.DebugProtocol.BreakpointLocationsResponse,
    args: debugProtocol.DebugProtocol.BreakpointLocationsArguments
  ): Promise<void> {
    if (!args.source.path) {
      response.body = { breakpoints: [] };
      this.sendResponse(response);
      return;
    }

    const document = await vscode.workspace.openTextDocument(
      this.convertClientPathToDebugger(args.source.path)
    );
    const startLine = this.convertClientLineToDebugger(args.line);
    const startColumn = args.column ? this.convertClientColumnToDebugger(args.column) : 0;
    const endLine = args.endLine ? this.convertClientLineToDebugger(args.endLine) : startLine;
    const endColumn = args.endColumn
      ? this.convertClientColumnToDebugger(args.endColumn)
      : document.lineAt(endLine).range.end.character;

    response.body = {
      breakpoints: breakpointLocationsForRange(
        document,
        new vscode.Range(startLine, startColumn, endLine, endColumn)
      ).map((location) => ({
        line: this.convertDebuggerLineToClient(location.range.start.line),
        column: this.convertDebuggerColumnToClient(location.range.start.character),
        endLine: this.convertDebuggerLineToClient(location.range.end.line),
        endColumn: this.convertDebuggerColumnToClient(location.range.end.character),
      })),
    };

    this.sendResponse(response);
  }

  protected setBreakPointsRequest(
    response: debugProtocol.DebugProtocol.SetBreakpointsResponse,
    args: debugProtocol.DebugProtocol.SetBreakpointsArguments,
    request?: debugProtocol.DebugProtocol.Request
  ): void {
    response.body = {
      breakpoints: (args.breakpoints ?? []).map((breakpoint) => ({
        verified: true,
        line: breakpoint.line,
        column: breakpoint.column,
      })),
    };

    this.sendResponse(response);
  }

  protected attachRequest(
    response: debugProtocol.DebugProtocol.AttachResponse,
    args: debugProtocol.DebugProtocol.AttachRequestArguments
  ): void {
    const session = replSession.getSession();

    this.sendResponse(response);
  }

  protected continueRequest(
    response: debugProtocol.DebugProtocol.ContinueResponse,
    args: debugProtocol.DebugProtocol.ContinueArguments,
    request?: debugProtocol.DebugProtocol.Request
  ): void {
    const session = replSession.getSession();

    if (session) {
      const { id, key } = cljsLib.getStateValue(DEBUG_RESPONSE_KEY);
      void session.sendDebugInput(':continue', id, key).then((response) => {
        this.sendEvent(new debugAdapter.StoppedEvent('breakpoint', CalvaDebugSession.THREAD_ID));
      });
    } else {
      response.success = false;
    }

    this.sendResponse(response);
  }

  protected restartRequest(
    response: debugProtocol.DebugProtocol.RestartResponse,
    args: debugProtocol.DebugProtocol.RestartArguments,
    request?: debugProtocol.DebugProtocol.Request
  ): void {
    response.success = false;
    this.sendResponse(response);
  }

  protected nextRequest(
    response: debugProtocol.DebugProtocol.NextResponse,
    args: debugProtocol.DebugProtocol.NextArguments,
    request?: debugProtocol.DebugProtocol.Request
  ): void {
    const session = replSession.getSession();

    if (session) {
      const { id, key } = cljsLib.getStateValue(DEBUG_RESPONSE_KEY);
      void session.sendDebugInput(':next', id, key).then((_) => {
        this.sendEvent(new debugAdapter.StoppedEvent('breakpoint', CalvaDebugSession.THREAD_ID));
      });
    } else {
      response.success = false;
    }

    this.sendResponse(response);
  }

  protected stepInRequest(
    response: debugProtocol.DebugProtocol.StepInResponse,
    args: debugProtocol.DebugProtocol.StepInArguments,
    request?: debugProtocol.DebugProtocol.Request
  ): void {
    const session = replSession.getSession();

    if (session) {
      const { id, key } = cljsLib.getStateValue(DEBUG_RESPONSE_KEY);
      void session.sendDebugInput(':in', id, key).then((_) => {
        this.sendEvent(new debugAdapter.StoppedEvent('breakpoint', CalvaDebugSession.THREAD_ID));
      });
    } else {
      response.success = false;
    }

    this.sendResponse(response);
  }

  protected stepOutRequest(
    response: debugProtocol.DebugProtocol.StepOutResponse,
    args: debugProtocol.DebugProtocol.StepOutArguments,
    request?: debugProtocol.DebugProtocol.Request
  ): void {
    const session = replSession.getSession();

    if (session) {
      const { id, key } = cljsLib.getStateValue(DEBUG_RESPONSE_KEY);
      void session.sendDebugInput(':out', id, key).then((_) => {
        this.sendEvent(new debugAdapter.StoppedEvent('breakpoint', CalvaDebugSession.THREAD_ID));
      });
    } else {
      response.success = false;
    }

    this.sendResponse(response);
  }

  protected threadsRequest(
    response: debugProtocol.DebugProtocol.ThreadsResponse,
    request?: debugProtocol.DebugProtocol.Request
  ): void {
    // We do not support multiple threads. Return a dummy thread.
    response.body = {
      threads: [new debugAdapter.Thread(CalvaDebugSession.THREAD_ID, 'thread 1')],
    };
    this.sendResponse(response);
  }

  private async _showDebugAnnotation(
    value: string,
    document: vscode.TextDocument,
    line: number,
    column: number
  ): Promise<void> {
    const range = new vscode.Range(line, column, line, column);
    const visibleEditor = vscode.window.visibleTextEditors.filter(
      (editor) => editor.document.fileName === document.fileName
    )[0];
    if (visibleEditor) {
      await vscode.window.showTextDocument(visibleEditor.document, visibleEditor.viewColumn);
    }
    const editor = visibleEditor || (await vscode.window.showTextDocument(document));
    annotations.clearEvaluationDecorations(editor);
    annotations.decorateResults(value, false, range, editor);
  }

  protected async stackTraceRequest(
    response: debugProtocol.DebugProtocol.StackTraceResponse,
    args: debugProtocol.DebugProtocol.StackTraceArguments,
    request?: debugProtocol.DebugProtocol.Request
  ): Promise<void> {
    const debugResponse = cljsLib.getStateValue(DEBUG_RESPONSE_KEY);
    const uri =
      debugResponse.file.startsWith('jar:') || debugResponse.file.startsWith('file:')
        ? vscode.Uri.parse(debugResponse.file)
        : vscode.Uri.file(debugResponse.file);
    const document = await vscode.workspace.openTextDocument(uri);
    const positionLine = convertOneBasedToZeroBased(debugResponse.line);
    const positionColumn = convertOneBasedToZeroBased(debugResponse.column);
    const offset = document.offsetAt(new vscode.Position(positionLine, positionColumn));
    const tokenCursor = docMirror.getDocument(document).getTokenCursor(offset);

    try {
      debugUtil.moveTokenCursorToBreakpoint(tokenCursor, debugResponse);
    } catch (e) {
      void vscode.window.showErrorMessage(
        'An error occurred in the breakpoint-finding logic. We would love if you submitted an issue in the Calva repo with the instrumented code, or a similar reproducible case.'
      );
      console.error('Calva debugger: moveTokenCursorToBreakpoint failed', e);
      this.sendEvent(new debugAdapter.TerminatedEvent());
      response.success = false;
      this.sendResponse(response);
      return;
    }

    const [line, column] = tokenCursor.rowCol;

    // Pass scheme in path argument to Source contructor so that if it's a jar file it's handled correctly
    const source = new debugAdapter.Source(path.basename(debugResponse.file), debugResponse.file);
    const name = tokenCursor.getFunctionName();
    const stackFrames = [new debugAdapter.StackFrame(0, name, source, line + 1, column + 1)];

    response.body = {
      stackFrames,
      totalFrames: stackFrames.length,
    };

    this.sendResponse(response);

    void this._showDebugAnnotation(debugResponse['debug-value'], document, line, column);
  }

  protected scopesRequest(
    response: debugProtocol.DebugProtocol.ScopesResponse,
    args: debugProtocol.DebugProtocol.ScopesArguments,
    request?: debugProtocol.DebugProtocol.Request
  ): void {
    response.body = {
      scopes: [new debugAdapter.Scope('Locals', this._variableHandles.create('locals'), false)],
    };

    this.sendResponse(response);
  }

  private _createVariableFromLocal(local: any[]): debugAdapter.Variable {
    const value = local[1] as string;
    const name = local[0] as string;
    const cursor = TokenCursor.createStringCursor(value);

    const variablesReference = cursorUtil.isRightSexpStructural(cursor)
      ? this._variableHandles.create(name)
      : 0;

    if (variablesReference !== 0) {
      const text = cursor.doc.getText(0, Infinity);
      this._variableStructures[name] = cursorUtil.structureForRightSexp(cursor);
    }

    return {
      name,
      value,
      variablesReference,
    };
  }

  protected variablesRequest(
    response: debugProtocol.DebugProtocol.VariablesResponse,
    args: debugProtocol.DebugProtocol.VariablesArguments,
    request?: debugProtocol.DebugProtocol.Request
  ): void {
    const id = this._variableHandles.get(args.variablesReference);

    if (id === 'locals') {
      const debugResponse = cljsLib.getStateValue(DEBUG_RESPONSE_KEY);
      const variables = debugResponse.locals.map((local) => this._createVariableFromLocal(local));

      response.body = { variables };
    } else {
      const structure = this._variableStructures[id];

      const variables =
        structure instanceof Map
          ? Array.from(structure.entries())
              .map(([keyObj, valueObj], index) => {
                let keyVariablesReference = 0;
                let valueVariablesReference = 0;

                if (typeof keyObj.value === 'object' && keyObj.value !== null) {
                  const newKey = `${id}.${index}.key`;
                  this._variableStructures[newKey] = keyObj.value;
                  keyVariablesReference = this._variableHandles.create(newKey);
                }

                if (typeof valueObj.value === 'object' && valueObj.value !== null) {
                  const newKey = `${id}.${index}.value`;
                  this._variableStructures[newKey] = valueObj.value;
                  valueVariablesReference = this._variableHandles.create(newKey);
                }

                const variables = [];
                if (keyVariablesReference > 0) {
                  variables.push({
                    name: '[key]',
                    value: keyObj.originalString,
                    variablesReference: keyVariablesReference,
                  });
                }
                variables.push({
                  name: keyObj.originalString,
                  value: valueObj.originalString,
                  variablesReference: valueVariablesReference,
                });

                return variables;
              })
              .flat()
          : structure.map((valueObj, index) => {
              let variablesReference = 0;

              if (typeof valueObj.value === 'object' && valueObj.value !== null) {
                const newKey = `${id}.${index}`;
                this._variableStructures[newKey] = valueObj.value;
                variablesReference = this._variableHandles.create(newKey);
              }

              return {
                name: String(index),
                value: valueObj.originalString,
                variablesReference,
              };
            });

      response.body = { variables };
    }

    this.sendResponse(response);
  }

  protected disconnectRequest(
    response: debugProtocol.DebugProtocol.DisconnectResponse,
    args: debugProtocol.DebugProtocol.DisconnectArguments,
    request?: debugProtocol.DebugProtocol.Request
  ): void {
    const session = replSession.getSession();

    if (session) {
      const { id, key } = cljsLib.getStateValue(DEBUG_RESPONSE_KEY);
      void session.sendDebugInput(':quit', id, key);
    }

    this.sendResponse(response);
  }

  protected terminateRequest(
    response: debugProtocol.DebugProtocol.TerminateResponse,
    args: debugProtocol.DebugProtocol.TerminateArguments,
    request?: debugProtocol.DebugProtocol.Request
  ): void {
    this.sendResponse(response);
  }

  protected customRequest(
    command: string,
    response: debugProtocol.DebugProtocol.Response,
    args: any,
    request?: debugProtocol.DebugProtocol.Request
  ): void {
    switch (command) {
      case REQUESTS.SEND_TERMINATED_EVENT: {
        this.sendEvent(new debugAdapter.TerminatedEvent());
        break;
      }
      case REQUESTS.SEND_STOPPED_EVENT: {
        this.sendEvent(
          new debugAdapter.StoppedEvent(
            args.reason,
            CalvaDebugSession.THREAD_ID,
            args.exceptionText
          )
        );
        break;
      }
    }

    this.sendResponse(response);
  }
}

CalvaDebugSession.run(CalvaDebugSession);

class CalvaDebugConfigurationProvider implements vscode.DebugConfigurationProvider {
  /**
   * Massage a debug configuration just before a debug session is being launched,
   * e.g. add all missing attributes to the debug configuration.
   */
  resolveDebugConfiguration(
    folder: vscode.WorkspaceFolder | undefined,
    config: vscode.DebugConfiguration,
    token?: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DebugConfiguration> {
    // If launch.json is missing or empty
    if (!config.type && !config.request && !config.name) {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === 'clojure') {
        config = { ...config, ...CALVA_DEBUG_CONFIGURATION };
      }
    }

    return config;
  }
}

class CalvaDebugAdapterDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {
  private server?: Net.Server;

  createDebugAdapterDescriptor(
    session: vscode.DebugSession,
    executable: vscode.DebugAdapterExecutable | undefined
  ): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
    if (!this.server) {
      // Start listening on a random port (0 means an arbitrary unused port will be used)
      this.server = Net.createServer((socket) => {
        const debugSession = new CalvaDebugSession();
        debugSession.setRunAsServer(true);
        debugSession.start(<NodeJS.ReadableStream>socket, socket);
      }).listen(0);
    }

    // Make VS Code connect to debug server
    return new vscode.DebugAdapterServer((this.server.address() as Net.AddressInfo).port);
  }

  dispose() {
    if (this.server) {
      this.server.close();
    }
  }
}

function calvaDebugSession(session: vscode.DebugSession) {
  return session?.type === CALVA_DEBUG_CONFIGURATION.type;
}

function onNreplMessage(data: any): void {
  if (vscode.debug.activeDebugSession && (data['value'] || data['err'])) {
    if (calvaDebugSession(vscode.debug.activeDebugSession)) {
      annotations.clearAllEvaluationDecorations();
      void vscode.debug.activeDebugSession.customRequest(REQUESTS.SEND_TERMINATED_EVENT);
    }
  } else if (data['status'] && data['status'].indexOf(NEED_DEBUG_INPUT_STATUS) !== -1) {
    handleNeedDebugInput(data);
  }
}

function handleNeedDebugInput(response: any): void {
  // Make sure the form exists in the editor and was not instrumented in the repl window
  if (
    typeof response.file === 'string' &&
    typeof response.column === 'number' &&
    typeof response.line === 'number'
  ) {
    cljsLib.setStateValue(DEBUG_RESPONSE_KEY, response);

    if (!vscode.debug.activeDebugSession) {
      void vscode.debug.startDebugging(undefined, CALVA_DEBUG_CONFIGURATION);
    }
  } else {
    const session = replSession.getSession();
    void session.sendDebugInput(':quit', response.id, response.key);
    void vscode.window.showInformationMessage(
      'Forms containing breakpoints that were not evaluated in the editor (such as if you evaluated a form in the REPL window) cannot be debugged. Evaluate the form in the editor in order to debug it.'
    );
  }
}

vscode.debug.onDidStartDebugSession((session) => {
  if (!calvaDebugSession(session)) {
    return;
  }

  // We only start debugger sessions when a breakpoint is hit
  void session.customRequest(REQUESTS.SEND_STOPPED_EVENT, {
    reason: 'breakpoint',
  });
});

function convertOneBasedToZeroBased(n: number): number {
  // Zero implies ignoring the line/column in the vscode-debugadapter StackFrame class, and perhaps in cider-nrepl as well
  return n === 0 ? n : n - 1;
}

function supportsDebuggerOps(session?: nrepl.NReplSession): boolean {
  return Boolean(session && DEBUGGER_OPS.every((op) => session.supports(op)));
}

function unsupportedDebuggerMessage(session?: nrepl.NReplSession): string {
  const sessionKey = session ? sessionRegistry.resolveSessionKey(session) : 'current';
  return `The ${sessionKey} nREPL session does not support debugger operations. Breakpoint UI is still available in VS Code, but Calva will not instrument or evaluate breakpoint forms for this session. Start the REPL with cider-nrepl debugger middleware to use breakpoints.`;
}

function warnUnsupportedDebugger(session?: nrepl.NReplSession, once = false): void {
  const sessionKey = session ? sessionRegistry.resolveSessionKey(session) : 'current';
  if (once && warnedUnsupportedSessionKeys.has(sessionKey)) {
    return;
  }
  warnedUnsupportedSessionKeys.add(sessionKey);
  void vscode.window.showWarningMessage(unsupportedDebuggerMessage(session));
}

function initializeDebugger(cljSession: nrepl.NReplSession): void {
  if (!supportsDebuggerOps(cljSession)) {
    warnUnsupportedDebugger(cljSession, true);
    return;
  }

  warnedUnsupportedSessionKeys.delete(sessionRegistry.resolveSessionKey(cljSession));
  cljSession.initDebugger();
  debugDecorations.activate();
  void syncExistingSourceBreakpoints();
}

function isClojureSourceBreakpoint(
  breakpoint: vscode.Breakpoint
): breakpoint is vscode.SourceBreakpoint {
  return (
    breakpoint instanceof vscode.SourceBreakpoint &&
    breakpoint.location.uri.scheme === 'file' &&
    breakpoint.location.uri.path.match(/\.(clj|cljc|cljd|cljr|cljx|clojure)$/) !== null
  );
}

function breakpointForm(breakpoint: vscode.SourceBreakpoint): string {
  return breakpoint.condition ? `#break ^{:break/when ${breakpoint.condition}} ` : '#break ';
}

function breakpointLocationsForRange(
  document: vscode.TextDocument,
  range: vscode.Range
): vscode.Location[] {
  const startOffset = document.offsetAt(range.start);
  const endOffset = document.offsetAt(range.end);

  return listFormOffsetsForRange(document, startOffset, endOffset).map(
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
    const token = tokenCursor.getToken();
    if (tokenCursor.offsetStart !== offset || token.type !== 'open' || !token.raw.endsWith('(')) {
      continue;
    }

    const [formStart] = tokenCursor.rangeForCurrentForm(offset);
    if (formStart < startOffset || formStart > endOffset || seen.has(formStart)) {
      continue;
    }

    seen.add(formStart);
    offsets.push(formStart);
  }

  return offsets;
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

  if (tokenCursor.offsetStart === offset && tokenCursor.getToken().type === 'open') {
    return offset;
  }

  if (tokenCursor.backwardFunction()) {
    return tokenCursor.offsetStart;
  }

  const [formStart] = tokenCursor.rangeForCurrentForm(offset);
  return formStart;
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

function breakpointTargetPosition(
  document: vscode.TextDocument,
  breakpoint: vscode.SourceBreakpoint
): vscode.Position {
  return document.positionAt(breakpointTargetOffset(document, breakpoint));
}

function injectBreakpoints(
  document: vscode.TextDocument,
  selection: vscode.Selection,
  code: string,
  breakpoints: vscode.SourceBreakpoint[]
): string {
  const selectionStartOffset = document.offsetAt(selection.start);

  return breakpoints
    .sort((a, b) => breakpointTargetOffset(document, b) - breakpointTargetOffset(document, a))
    .reduce((instrumentedCode, breakpoint) => {
      const relativeOffset = breakpointTargetOffset(document, breakpoint) - selectionStartOffset;

      if (relativeOffset < 0 || relativeOffset > instrumentedCode.length) {
        return instrumentedCode;
      }

      return (
        instrumentedCode.slice(0, relativeOffset) +
        breakpointForm(breakpoint) +
        instrumentedCode.slice(relativeOffset)
      );
    }, code);
}

function instrumentCodeWithSourceBreakpoints(
  document: vscode.TextDocument,
  selection: vscode.Selection,
  code: string,
  session?: nrepl.NReplSession
): string {
  const breakpoints = vscode.debug.breakpoints
    .filter(isClojureSourceBreakpoint)
    .filter(
      (breakpoint) =>
        breakpoint.location.uri.toString() === document.uri.toString() &&
        selection.contains(breakpointTargetPosition(document, breakpoint))
    );

  if (breakpoints.length > 0 && !supportsDebuggerOps(session)) {
    warnUnsupportedDebugger(session, true);
    return code;
  }

  return breakpoints.length === 0
    ? code
    : injectBreakpoints(document, selection, code, breakpoints);
}

async function evaluateTopLevelFormForBreakpoint(
  document: vscode.TextDocument,
  position: vscode.Position
): Promise<void> {
  if (!util.getConnectedState()) {
    return;
  }

  const session = replSession.getSession();
  if (!session) {
    return;
  }

  if (!supportsDebuggerOps(session)) {
    warnUnsupportedDebugger(session, true);
    return;
  }

  const [selection, code] = getText.currentTopLevelFormText(document, position);
  if (!selection || code.length === 0) {
    return;
  }

  const [ns, nsForm] = namespace.getNamespace(document, selection.end);
  const codeToEvaluate = instrumentCodeWithSourceBreakpoints(document, selection, code, session);

  try {
    if (breakpointCodeEvaluator) {
      await breakpointCodeEvaluator(
        codeToEvaluate,
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
    } else {
      await session.evaluateInNs(nsForm, ns);
      await session.eval(codeToEvaluate, ns, {
        file: document.fileName,
        line: selection.start.line + 1,
        column: selection.start.character + 1,
        pprintOptions: { enabled: false } as any,
      }).value;
    }
    debugDecorations.triggerUpdateAndRenderDecorations();
  } catch (e) {
    void vscode.window.showWarningMessage(`Failed instrumenting breakpoint: ${e.message ?? e}`);
  }
}

async function syncChangedSourceBreakpoints(event: vscode.BreakpointsChangeEvent): Promise<void> {
  const changedBreakpoints = [...event.added, ...event.removed, ...event.changed].filter(
    isClojureSourceBreakpoint
  );
  void syncSourceBreakpoints(changedBreakpoints);
}

async function syncExistingSourceBreakpoints(): Promise<void> {
  const breakpoints = vscode.debug.breakpoints.filter(isClojureSourceBreakpoint);
  void syncSourceBreakpoints(breakpoints);
}

async function syncSourceBreakpointsForDocument(document?: vscode.TextDocument): Promise<void> {
  if (!document) {
    return;
  }

  const breakpoints = vscode.debug.breakpoints
    .filter(isClojureSourceBreakpoint)
    .filter((breakpoint) => breakpoint.location.uri.toString() === document.uri.toString());
  void syncSourceBreakpoints(breakpoints);
}

async function syncSourceBreakpoints(breakpoints: vscode.SourceBreakpoint[]): Promise<void> {
  const seenTopLevelForms = new Set<string>();

  for (const breakpoint of breakpoints) {
    const document = await vscode.workspace.openTextDocument(breakpoint.location.uri);
    if (document.languageId !== 'clojure') {
      continue;
    }

    const targetPosition = breakpointTargetPosition(document, breakpoint);
    const [selection] = getText.currentTopLevelFormText(document, targetPosition);
    if (!selection) {
      continue;
    }

    const key = [
      document.uri.toString(),
      selection.start.line,
      selection.start.character,
      selection.end.line,
      selection.end.character,
    ].join(':');
    if (seenTopLevelForms.has(key)) {
      continue;
    }
    seenTopLevelForms.add(key);

    await evaluateTopLevelFormForBreakpoint(document, targetPosition);
  }
}

function registerSourceBreakpointInstrumentation(
  context: vscode.ExtensionContext,
  evaluator?: BreakpointCodeEvaluator
): void {
  breakpointCodeEvaluator = evaluator;
  context.subscriptions.push(
    vscode.debug.onDidChangeBreakpoints((event) => {
      void syncChangedSourceBreakpoints(event);
    }),
    sessionRegistry.onDidChangeSessions((event) => {
      if (event.type !== 'registered') {
        void syncExistingSourceBreakpoints();
      }
    }),
    sessionRouting.onDidChangeRouting(() => {
      void syncExistingSourceBreakpoints();
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      void syncSourceBreakpointsForDocument(editor?.document);
    })
  );
  void syncExistingSourceBreakpoints();
}

function terminateDebugSession(): void {
  if (!calvaDebugSession(vscode.debug.activeDebugSession)) {
    return;
  }

  if (vscode.debug.activeDebugSession) {
    void vscode.debug.activeDebugSession.customRequest(REQUESTS.SEND_TERMINATED_EVENT);
  }
  debugDecorations.triggerUpdateAndRenderDecorations();
}

export {
  CALVA_DEBUG_CONFIGURATION,
  DEBUG_ANALYTICS,
  REQUESTS,
  NEED_DEBUG_INPUT_STATUS,
  DEBUG_RESPONSE_KEY,
  DEBUG_QUIT_VALUE,
  CalvaDebugConfigurationProvider,
  CalvaDebugAdapterDescriptorFactory,
  handleNeedDebugInput,
  initializeDebugger,
  instrumentCodeWithSourceBreakpoints,
  onNreplMessage,
  registerSourceBreakpointInstrumentation,
  supportsDebuggerOps,
  warnUnsupportedDebugger,
  terminateDebugSession,
};
