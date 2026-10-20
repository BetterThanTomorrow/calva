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
import * as sessionEvents from '../nrepl/session-events';
import * as sessionRouting from '../nrepl/session-routing';
import { reconcileDebuggerSession } from './session-lifecycle';
import * as TokenCursor from '../cursor-doc/token-cursor';
import * as cursorUtil from '../cursor-doc/utilities';
import * as getText from '../util/get-text';
import * as namespace from '../namespace';
import {
  affectedBreakpointLocations,
  reconcileBreakpointLocations,
  type BreakpointLocation,
} from './source-breakpoint-sync';
import { UnsupportedWarningState } from './unsupported-warning-state';
import { advanceAfterDisconnect } from './disconnect-action';
import {
  insertBreakpointForms,
  insertDebugScopes,
  isBreakpointSupported,
  offsetAfterDebugScopes,
  type DebugScopeInsertion,
} from './breakpoint-encoding';
import {
  DEBUGGER_OPS,
  isClojureFamilySourcePath,
  instrumentSourceCodeWhenSupported,
  supportsDebuggerOps,
  formatUnsupportedDebuggerMessage,
} from './debugger-ops';

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
const unsupportedWarningState = new UnsupportedWarningState<nrepl.NReplSession>();
const initializedDebuggerSessions = new WeakSet<nrepl.NReplSession>();

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
    const session = replSession.getSession();
    const supported = isBreakpointSupported(
      Boolean(args.source.path && isClojureFamilySourcePath(args.source.path)),
      supportsDebuggerOps(session)
    );
    response.body = {
      breakpoints: (args.breakpoints ?? []).map((breakpoint) => ({
        verified: supported,
        ...(!supported ? { message: breakpointSupportMessage(args.source.path, session) } : {}),
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
      // Continue releases the VS Code debug UI while leaving cider-nrepl's
      // debugger loop running. The next breakpoint hit starts a fresh DAP
      // session from handleNeedDebugInput.
      void session.sendDebugInput(':continue', id, key).catch((error) => {
        console.error('Calva debugger: failed to continue execution', error);
      });
      this.sendResponse(response);
      this.sendEvent(new debugAdapter.TerminatedEvent());
      return;
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
    response.message = 'Restart is not available in Calva. Use Continue to resume execution.';
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
        this.sendEvent(new debugAdapter.StoppedEvent('step', CalvaDebugSession.THREAD_ID));
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
    response.success = false;
    response.message = 'Step In is not available in Calva. Use Step Over or Continue.';
    this.sendResponse(response);
  }

  protected stepOutRequest(
    response: debugProtocol.DebugProtocol.StepOutResponse,
    args: debugProtocol.DebugProtocol.StepOutArguments,
    request?: debugProtocol.DebugProtocol.Request
  ): void {
    response.success = false;
    response.message = 'Step Out is not available in Calva. Use Step Over or Continue.';
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
    // Report the live stopped location so VS Code moves the execution
    // highlight as stepping advances. Source breakpoints remain managed
    // separately by the editor and keep their configured gutter positions.
    const source = new debugAdapter.Source(path.basename(debugResponse.file), debugResponse.file);
    const stackFrames = [
      new debugAdapter.StackFrame(0, tokenCursor.getFunctionName(), source, line + 1, column + 1),
    ];

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
    const { id, key } = cljsLib.getStateValue(DEBUG_RESPONSE_KEY);

    if (!session || !id || !key) {
      response.success = false;
      response.message = 'Cannot advance because the debugger session is no longer available.';
      this.sendResponse(response);
      return;
    }

    // The Disconnect toolbar command ends the current DAP session. Release it
    // before stepping so a subsequent need-debug-input can start a new session.
    advanceAfterDisconnect(
      session,
      id,
      key,
      () => this.sendResponse(response),
      (error) => {
        console.error('Calva debugger: failed to advance after disconnect', error);
      }
    );
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

function breakpointSupportMessage(
  sourcePath: string | undefined,
  session: nrepl.NReplSession
): string {
  if (!sourcePath) {
    return 'Breakpoint source path is unavailable.';
  }
  if (!isClojureFamilySourcePath(sourcePath)) {
    return 'Calva GUI breakpoints require a Clojure-family source file.';
  }
  return unsupportedDebuggerMessage(session);
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

type DebugInputResponse = {
  file?: unknown;
  column?: unknown;
  line?: unknown;
  id?: string;
  key?: string;
};

function hasSourceLocation(response: DebugInputResponse): response is DebugInputResponse & {
  file: string;
  column: number;
  line: number;
} {
  return (
    typeof response.file === 'string' &&
    typeof response.column === 'number' &&
    typeof response.line === 'number'
  );
}

function handleNeedDebugInput(response: DebugInputResponse): void {
  // Make sure the form exists in the editor and was not instrumented in the repl window
  if (hasSourceLocation(response)) {
    cljsLib.setStateValue(DEBUG_RESPONSE_KEY, response);

    if (!vscode.debug.activeDebugSession) {
      exposeOrAdvanceStop(response);
    }
  } else {
    const session = replSession.getSession();
    void session.sendDebugInput(':quit', response.id, response.key);
    void vscode.window.showInformationMessage(
      'Forms containing breakpoints that were not evaluated in the editor (such as if you evaluated a form in the REPL window) cannot be debugged. Evaluate the form in the editor in order to debug it.'
    );
  }
}

function exposeOrAdvanceStop(
  response: DebugInputResponse & { file: string; line: number; column: number }
): void {
  if (!sourceBreakpointStepTargets?.length) {
    void vscode.debug.startDebugging(undefined, CALVA_DEBUG_CONFIGURATION);
    return;
  }
  void shouldExposeSourceBreakpointStop(response).then((isTargetStop) => {
    if (isTargetStop) {
      void vscode.debug.startDebugging(undefined, CALVA_DEBUG_CONFIGURATION);
    } else {
      advanceToNextGuiBreakpoint(response);
    }
  });
}

function advanceToNextGuiBreakpoint(response: DebugInputResponse): void {
  setTimeout(() => {
    const session = replSession.getSession();
    if (session) {
      void session.sendDebugInput(':next', response.id, response.key).catch((error) => {
        console.error('Calva debugger: failed auto-stepping to GUI breakpoint', error);
      });
    }
  }, 0);
}

async function shouldExposeSourceBreakpointStop(
  response: DebugInputResponse & { file: string; line: number; column: number }
): Promise<boolean> {
  try {
    return await matchesSourceBreakpointTarget(response, sourceBreakpointStepTargets);
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

async function matchesSourceBreakpointTarget(
  response: DebugInputResponse & { file: string; line: number; column: number },
  targets: { file: string; formStart: number; endOffset: number }[] | undefined
): Promise<boolean> {
  if (!targets?.length) {
    return true;
  }
  const uri = sourceLocationUri(response.file);
  const document = await vscode.workspace.openTextDocument(uri);
  const offset = document.offsetAt(
    new vscode.Position(
      convertOneBasedToZeroBased(response.line),
      convertOneBasedToZeroBased(response.column)
    )
  );
  const cursor = docMirror.getDocument(document).getTokenCursor(offset);
  const responseFormRange = cursor.rangeForDefun(offset);
  if (!targets.some((target) => targetMatchesForm(target, uri, responseFormRange?.[0]))) {
    return true;
  }
  debugUtil.moveTokenCursorToBreakpoint(cursor, response);
  return !targets.some((target) => targetMatchesStop(target, uri, cursor.offsetStart));
}

function sourceLocationUri(file: string): vscode.Uri {
  return file.startsWith('jar:') || file.startsWith('file:')
    ? vscode.Uri.parse(file)
    : vscode.Uri.file(file);
}

function targetMatchesForm(
  target: { file: string; formStart: number },
  uri: vscode.Uri,
  formStart: number | undefined
): boolean {
  return (
    vscode.Uri.file(target.file).toString() === uri.toString() && target.formStart === formStart
  );
}

function targetMatchesStop(
  target: { file: string; endOffset: number },
  uri: vscode.Uri,
  offset: number
): boolean {
  return vscode.Uri.file(target.file).toString() === uri.toString() && target.endOffset === offset;
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

function unsupportedDebuggerMessage(session?: nrepl.NReplSession): string {
  const sessionKey = session ? sessionRegistry.resolveSessionKey(session) : 'current';
  return formatUnsupportedDebuggerMessage(sessionKey, session);
}

function warnUnsupportedDebugger(session?: nrepl.NReplSession): void {
  const missingOps = DEBUGGER_OPS.filter((op) => !session?.supports(op)).join(',');
  if (!unsupportedWarningState.shouldWarn(session, missingOps)) {
    return;
  }
  void vscode.window.showWarningMessage(unsupportedDebuggerMessage(session));
}

function initializeDebugger(cljSession: nrepl.NReplSession): void {
  unsupportedWarningState.clear(cljSession);
  if (!supportsDebuggerOps(cljSession)) {
    return;
  }

  if (!initializedDebuggerSessions.has(cljSession)) {
    initializedDebuggerSessions.add(cljSession);
    cljSession.initDebugger();
  }
  debugDecorations.activate();
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

function breakpointTargetPosition(
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

function instrumentCodeWithSourceBreakpoints(
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
    warnUnsupportedDebugger(session);
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
    warnUnsupportedDebugger(session);
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

function registerSourceBreakpointInstrumentation(
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

function shouldReconcileDebuggerSession(eventType: string): boolean {
  return new Set([
    'session-added',
    'session-removed',
    'connection-added',
    'connection-removed',
    'session-renamed',
  ]).has(eventType);
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
  breakpointTargetPosition,
  breakpointLocationsForRange,
  onNreplMessage,
  registerSourceBreakpointInstrumentation,
  supportsDebuggerOps,
  warnUnsupportedDebugger,
  terminateDebugSession,
};
