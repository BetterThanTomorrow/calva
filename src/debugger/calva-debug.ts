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
import * as TokenCursor from '../cursor-doc/token-cursor';
import * as cursorUtil from '../cursor-doc/utilities';
import * as sessionRegistry from '../nrepl/session-registry';
import { sendInitializeResponse } from './initialize-capabilities';
import { requestSourceBreakpoints, setGutterBreakpointContext } from './gui-breakpoints';
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
    response: debugProtocol.DebugProtocol.InitializeResponse,
    args: debugProtocol.DebugProtocol.InitializeRequestArguments
  ): void {
    this.setDebuggerLinesStartAt1(args.linesStartAt1);
    this.setDebuggerColumnsStartAt1(args.columnsStartAt1);

    // Build and return the capabilities of this debug adapter
    sendInitializeResponse(response, (initializeResponse) => this.sendResponse(initializeResponse));
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
    this.sendDebugInputUntilNextStop(response, ':continue');
  }

  /**
   * An evaluation paused at a breakpoint has nothing to restart, so Restart ends the debugging,
   * as Stop does.
   */
  protected restartRequest(
    response: debugProtocol.DebugProtocol.RestartResponse,
    args: debugProtocol.DebugProtocol.RestartArguments,
    request?: debugProtocol.DebugProtocol.Request
  ): void {
    quitDebuggedEvaluation();
    this.sendResponse(response);
    this.sendEvent(new debugAdapter.TerminatedEvent());
  }

  protected nextRequest(
    response: debugProtocol.DebugProtocol.NextResponse,
    args: debugProtocol.DebugProtocol.NextArguments,
    request?: debugProtocol.DebugProtocol.Request
  ): void {
    this.sendDebugInputUntilNextStop(response, ':next');
  }

  protected stepInRequest(
    response: debugProtocol.DebugProtocol.StepInResponse,
    args: debugProtocol.DebugProtocol.StepInArguments,
    request?: debugProtocol.DebugProtocol.Request
  ): void {
    this.sendDebugInputUntilNextStop(response, ':in');
  }

  protected stepOutRequest(
    response: debugProtocol.DebugProtocol.StepOutResponse,
    args: debugProtocol.DebugProtocol.StepOutArguments,
    request?: debugProtocol.DebugProtocol.Request
  ): void {
    this.sendDebugInputUntilNextStop(response, ':out');
  }

  /**
   * Sends `input` for the stored stop. cider-nrepl answers with the next stop,
   * which `handleNeedDebugInput` stores before the stopped event is sent.
   */
  private sendDebugInputUntilNextStop(
    response: debugProtocol.DebugProtocol.Response,
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
    quitDebuggedEvaluation();
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

const DEBUGGER_DOCS_URL = 'https://calva.io/debugger/';
const RUN_AND_DEBUG_MESSAGE =
  "Calva's debugger doesn't start from Run and Debug. It starts when code you evaluate reaches a breakpoint: a #break in the code, a function you instrumented for debugging, or a gutter breakpoint in a .clj or .cljc file. Evaluate the form with the breakpoint, then call the code.";
const READ_ABOUT_DEBUGGER = "Read about Calva's debugger";

async function showRunAndDebugMessage(): Promise<void> {
  const choice = await vscode.window.showInformationMessage(
    RUN_AND_DEBUG_MESSAGE,
    READ_ABOUT_DEBUGGER
  );
  if (choice === READ_ABOUT_DEBUGGER) {
    await vscode.env.openExternal(vscode.Uri.parse(DEBUGGER_DOCS_URL));
  }
}

function isEmptyConfiguration(config: vscode.DebugConfiguration): boolean {
  return !config.type && !config.request && !config.name;
}

class CalvaDebugConfigurationProvider implements vscode.DebugConfigurationProvider {
  /**
   * Run and Debug (F5) without a launch.json comes here with an empty configuration.
   * Calva's debug session starts from a debugger stop, so explain that and start nothing.
   */
  resolveDebugConfiguration(
    folder: vscode.WorkspaceFolder | undefined,
    config: vscode.DebugConfiguration,
    token?: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DebugConfiguration> {
    if (isEmptyConfiguration(config)) {
      void showRunAndDebugMessage();
      return undefined;
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

/**
 * The running Calva Debug session. Other debug sessions, such as an Extension Development Host,
 * can run at the same time, so the active debug session isn't necessarily this one.
 */
let runningCalvaDebugSession: vscode.DebugSession | undefined;

function isCalvaDebugSessionRunning(): boolean {
  return runningCalvaDebugSession !== undefined;
}

/** Sends :quit for the stop the debugger is paused at, if there is one. */
function quitDebuggedEvaluation(): void {
  const session = replSession.getSession();
  const debugResponse = cljsLib.getStateValue(DEBUG_RESPONSE_KEY);

  if (session && debugResponse) {
    void session.sendDebugInput(':quit', debugResponse.id, debugResponse.key);
  }
}

function onNreplMessage(data: any): void {
  if (runningCalvaDebugSession && (data['value'] || data['err'])) {
    annotations.clearAllEvaluationDecorations();
    void runningCalvaDebugSession.customRequest(REQUESTS.SEND_TERMINATED_EVENT);
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

    if (!runningCalvaDebugSession) {
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

vscode.debug.onDidTerminateDebugSession((session) => {
  if (session.id === runningCalvaDebugSession?.id) {
    runningCalvaDebugSession = undefined;
  }
});

vscode.debug.onDidStartDebugSession((session) => {
  if (!calvaDebugSession(session)) {
    return;
  }
  runningCalvaDebugSession = session;

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
  if (!runningCalvaDebugSession) {
    return;
  }

  void runningCalvaDebugSession.customRequest(REQUESTS.SEND_TERMINATED_EVENT);
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
  isCalvaDebugSessionRunning,
  onNreplMessage,
  setGutterBreakpointContext,
  showInstrumentUnsupportedError,
  supportsDebuggerOps,
  terminateDebugSession,
};
