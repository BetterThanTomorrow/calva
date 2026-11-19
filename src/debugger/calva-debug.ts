import * as debugAdapter from '@vscode/debugadapter';
import type { DebugProtocol } from '@vscode/debugprotocol';
import * as Net from 'net';
import * as state from '../state';
import * as path from 'path';
import * as vscode from 'vscode';
import * as docMirror from '../doc-mirror/index';
import * as replSession from '../nrepl/repl-session';
import * as sessionRegistry from '../nrepl/session-registry';
import * as debugUtil from './util';
import * as annotations from '../providers/annotations';
import type * as nrepl from '../nrepl';
import * as debugDecorations from './decorations';
import * as cljsLib from '../../out/cljs-lib/cljs-lib';
import * as TokenCursor from '../cursor-doc/token-cursor';
import * as cursorUtil from '../cursor-doc/utilities';
import { sendInitializeResponse } from './initialize-capabilities';
import { handleRestartRequest } from './request-handlers';
import { requestSourceBreakpoints } from './gui-breakpoints';
import { supportsDebuggerOps, formatInstrumentUnsupportedMessage } from './debugger-ops';

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
    response: DebugProtocol.InitializeResponse,
    args: DebugProtocol.InitializeRequestArguments
  ): void {
    this.setDebuggerLinesStartAt1(args.linesStartAt1);
    this.setDebuggerColumnsStartAt1(args.columnsStartAt1);

    // Build and return the capabilities of this debug adapter
    sendInitializeResponse(response, (initializeResponse) => this.sendResponse(initializeResponse));
  }

  protected attachRequest(
    response: DebugProtocol.AttachResponse,
    args: DebugProtocol.AttachRequestArguments
  ): void {
    const session = replSession.getSession();

    this.sendResponse(response);
  }

  protected continueRequest(
    response: DebugProtocol.ContinueResponse,
    args: DebugProtocol.ContinueArguments,
    request?: DebugProtocol.Request
  ): void {
    this.sendDebugInputUntilNextStop(response, ':continue');
  }

  protected restartRequest(
    response: DebugProtocol.RestartResponse,
    args: DebugProtocol.RestartArguments,
    request?: DebugProtocol.Request
  ): void {
    handleRestartRequest(response, (result) => this.sendResponse(result));
  }

  protected nextRequest(
    response: DebugProtocol.NextResponse,
    args: DebugProtocol.NextArguments,
    request?: DebugProtocol.Request
  ): void {
    this.sendDebugInputUntilNextStop(response, ':next');
  }

  protected stepInRequest(
    response: DebugProtocol.StepInResponse,
    args: DebugProtocol.StepInArguments,
    request?: DebugProtocol.Request
  ): void {
    this.sendDebugInputUntilNextStop(response, ':in');
  }

  protected stepOutRequest(
    response: DebugProtocol.StepOutResponse,
    args: DebugProtocol.StepOutArguments,
    request?: DebugProtocol.Request
  ): void {
    this.sendDebugInputUntilNextStop(response, ':out');
  }

  /**
   * Sends `input` for the stored stop. cider-nrepl answers with the next stop,
   * which `handleNeedDebugInput` stores before the stopped event is sent.
   */
  private sendDebugInputUntilNextStop(
    response: DebugProtocol.Response,
    input: ':continue' | ':next' | ':in' | ':out'
  ): void {
    const session = replSession.getSession();

    if (session) {
      const { id, key } = cljsLib.getStateValue(DEBUG_RESPONSE_KEY) ?? {};
      void session.sendDebugInput(input, id, key).then((_) => {
        this.sendEvent(new debugAdapter.StoppedEvent('breakpoint', CalvaDebugSession.THREAD_ID));
      });
    } else {
      response.success = false;
    }

    this.sendResponse(response);
  }

  protected threadsRequest(
    response: DebugProtocol.ThreadsResponse,
    request?: DebugProtocol.Request
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
    response: DebugProtocol.StackTraceResponse,
    args: DebugProtocol.StackTraceArguments,
    request?: DebugProtocol.Request
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
    response: DebugProtocol.ScopesResponse,
    args: DebugProtocol.ScopesArguments,
    request?: DebugProtocol.Request
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
    response: DebugProtocol.VariablesResponse,
    args: DebugProtocol.VariablesArguments,
    request?: DebugProtocol.Request
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
    response: DebugProtocol.DisconnectResponse,
    args: DebugProtocol.DisconnectArguments,
    request?: DebugProtocol.Request
  ): void {
    const session = replSession.getSession();
    const debugResponse = cljsLib.getStateValue(DEBUG_RESPONSE_KEY);

    if (session && debugResponse) {
      void session.sendDebugInput(':quit', debugResponse.id, debugResponse.key);
    }

    this.sendResponse(response);
  }

  protected terminateRequest(
    response: DebugProtocol.TerminateResponse,
    args: DebugProtocol.TerminateArguments,
    request?: DebugProtocol.Request
  ): void {
    this.sendResponse(response);
  }

  protected customRequest(
    command: string,
    response: DebugProtocol.Response,
    args: any,
    request?: DebugProtocol.Request
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

function isEvaluationResult(data: any): boolean {
  return Boolean(data['value'] || data['err']);
}

function onNreplMessage(data: any): void {
  if (vscode.debug.activeDebugSession && isEvaluationResult(data)) {
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

function showInstrumentUnsupportedError(session?: nrepl.NReplSession): void {
  const sessionKey = sessionRegistry.resolveSessionKey(session, 'current');
  void vscode.window.showErrorMessage(formatInstrumentUnsupportedMessage(sessionKey));
}

function initializeDebugger(cljSession: nrepl.NReplSession): void {
  cljSession.initDebugger();
  debugDecorations.activate();
  requestSourceBreakpoints();
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
  onNreplMessage,
  showInstrumentUnsupportedError,
  supportsDebuggerOps,
  terminateDebugSession,
};
