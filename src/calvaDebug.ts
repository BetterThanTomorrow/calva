import { LoggingDebugSession, TerminatedEvent, Thread, StoppedEvent, StackFrame, Source, Scope, Handles, Variable } from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import {
    debug, window, DebugConfigurationProvider, WorkspaceFolder, DebugConfiguration, CancellationToken, ProviderResult, DebugAdapterDescriptorFactory,
    DebugAdapterDescriptor, DebugSession, DebugAdapterExecutable, DebugAdapterServer, Position
} from 'vscode';
import * as util from './utilities';
import * as Net from 'net';
import * as state from './state';
import { basename } from 'path';
import * as docMirror from './doc-mirror';
import * as vscode from 'vscode';
import { replWindows } from './repl-window';
import { TokenCursor, LispTokenCursor } from './cursor-doc/token-cursor';

const CALVA_DEBUG_CONFIGURATION: DebugConfiguration = {
    type: 'clojure',
    name: 'Calva Debug',
    request: 'attach'
};

const REQUESTS = {
    SEND_STOPPED_EVENT: 'send-stopped-event',
    SEND_TERMINATED_EVENT: 'send-terminated-event'
};

const NEED_DEBUG_INPUT_STATUS = 'need-debug-input';
const DEBUG_RESPONSE_KEY = 'debug-response';

class CalvaDebugSession extends LoggingDebugSession {

    // We don't support multiple threads, so we can use a hardcoded ID for the default thread
    static THREAD_ID = 1;

    private _variableHandles = new Handles<string>();

    public constructor() {
        super('calva-debug-logs.txt');
    }

    /**
	 * The 'initialize' request is the first request called by the frontend
	 * to interrogate the features the debug adapter provides.
	 */
    protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {

        const cljSession = util.getSession('clj');
        if (!cljSession) {
            window.showInformationMessage('You must be connected to a Clojure REPL to use debugging.');
            this.sendEvent(new TerminatedEvent());
            return;
        }

        this.setDebuggerLinesStartAt1(args.linesStartAt1);
        this.setDebuggerColumnsStartAt1(args.columnsStartAt1);

        // Build and return the capabilities of this debug adapter
        response.body = {
            ...response.body
        };

        this.sendResponse(response);
    }

    protected async attachRequest(response: DebugProtocol.AttachResponse, args: DebugProtocol.AttachRequestArguments): Promise<void> {

        const cljReplWindow = replWindows['clj'];

        if (cljReplWindow) {
            await cljReplWindow.startDebugMode(util.getSession('clj'));
        }

        this.sendResponse(response);
    }

    protected threadsRequest(response: DebugProtocol.ThreadsResponse, request?: DebugProtocol.Request): void {
        // We do not support multiple threads. Return a dummy thread.
        response.body = {
            threads: [
                new Thread(CalvaDebugSession.THREAD_ID, 'thread 1')
            ]
        };
        this.sendResponse(response);
    }

    private _convertOneBasedToZeroBased(n: number): number {
        // Zero implies ignoring the line/column in the vscode-debugadapter StackFrame class, and perhaps in cider-nrepl as well
        return n === 0 ? n : n - 1;
    }

    private _moveCursorPastStringInList(tokenCursor: LispTokenCursor, s: string, document: vscode.TextDocument): void {
        const [listOffsetStart, listOffsetEnd] = tokenCursor.rangeForList();
        const startPosition = document.positionAt(listOffsetStart);
        const endPosition = document.positionAt(listOffsetEnd - 1);
        const text = document.getText(new vscode.Range(startPosition, endPosition));

        const stringIndexInList = text.indexOf(s);
        if (stringIndexInList !== -1) {
            const coorOffset = listOffsetStart + stringIndexInList;
            while (tokenCursor.offsetStart !== coorOffset) {
                tokenCursor.forwardSexp();
                tokenCursor.forwardWhitespace();
            }
            tokenCursor.forwardSexp();
        }
    }

    protected async stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments, request?: DebugProtocol.Request): Promise<void> {

        //// cider-nrepl seems to have 1-based lines and columns. StackFrames have 1-based lines and columns. The editor has 0-based lines and columns.

        const debugResponse = state.deref().get(DEBUG_RESPONSE_KEY);
        const coor = debugResponse.coor;
        const document = await vscode.workspace.openTextDocument(debugResponse.file);
        const positionLine = this._convertOneBasedToZeroBased(debugResponse.line);
        const positionColumn = this._convertOneBasedToZeroBased(debugResponse.column);
        const offset = document.offsetAt(new Position(positionLine, positionColumn));
        const tokenCursor = docMirror.getDocument(document).getTokenCursor(offset);
        let inSyntaxQuote = false;

        for (let i = 0; i < coor.length; i++) {
            while (!tokenCursor.downList(true)) {
                tokenCursor.next();
            }
            const previousToken = tokenCursor.getPrevToken();

            // Check if we just entered a syntax quote, since we have to account for how syntax quoted forms are read
            // `(. .) is read as (seq (concat (list .) (list .))).
            if (/.*\`(\[|\{|\()$/.test(previousToken.raw)) {
                inSyntaxQuote = true;
            }

            if (inSyntaxQuote) {
                i++; // Ignore this coor and move to the next

                // A syntax quote is ending - this happens if ~ or ~@ precedes a form
                if (previousToken.raw.match(/~@?/)) {
                    inSyntaxQuote = false;
                }
            }

            if (inSyntaxQuote) {
                if (!previousToken.raw.endsWith('(')) {
                    // Non-list seqs like `[] and `{} are read with an extra (apply vector ...) or (apply hash-map ...)
                    // Ignore this coor too
                    i++;
                }
                // Now we're inside the `concat` form, but we need to ignore the actual `concat` symbol
                coor[i]--;
            }

            // #() expands to (fn* ([] ...)) and this is what coor is calculated with, so ignore this coor and move to the next
            if (previousToken.raw.endsWith('#(')) {
                i++;
            }

            // If coor is a string it represents a map key
            if (typeof coor[i] === 'string') {
                this._moveCursorPastStringInList(tokenCursor, coor[i], document);
            } else {
                for (let k = 0; k < coor[i]; k++) {
                    tokenCursor.forwardSexp(true, true, true);
                }
            }
        }
        
        // Move past the target sexp
        tokenCursor.forwardSexp(true, true, true);

        const [line, column] = tokenCursor.rowCol;

        const filePath = debugResponse.file;
        const source = new Source(basename(filePath), filePath);
        const name = tokenCursor.getFunction();
        const stackFrames = [new StackFrame(0, name, source, line + 1, column + 1)];

        response.body = {
            stackFrames,
            totalFrames: stackFrames.length
        };

        this.sendResponse(response);
    }

    protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments, request?: DebugProtocol.Request): void {

        response.body = {
            scopes: [
                new Scope("Locals", this._variableHandles.create('locals'), false)
            ]
        };

        this.sendResponse(response);
    }

    private _createVariableFromLocal(local: any[]): Variable {
        return {
            name: local[0],
            value: local[1],
            // DEBUG TODO: May need to check type of value. If it's a map or collection, we may need to set variablesReference to something > 0.
            /** If variablesReference is > 0, the variable is structured and its children can be retrieved by passing variablesReference to the VariablesRequest. */
            variablesReference: 0
        }
    }

    protected async variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments, request?: DebugProtocol.Request): Promise<void> {

        const debugResponse = state.deref().get(DEBUG_RESPONSE_KEY);

        response.body = {
            variables: debugResponse.locals.map(this._createVariableFromLocal)
        };

        this.sendResponse(response);

        vscode.window.showTextDocument(vscode.window.activeTextEditor.document);
    }

    protected async continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments, request?: DebugProtocol.Request): Promise<void> {

        const cljSession = util.getSession('clj');
        const { id, key } = state.deref().get(DEBUG_RESPONSE_KEY);

        if (cljSession) {
            cljSession.sendDebugInput(':continue', id, key).then(response => {
                this.sendEvent(new StoppedEvent('breakpoint', CalvaDebugSession.THREAD_ID));
            });
        }

        this.sendResponse(response);
    }

    protected async disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments, request?: DebugProtocol.Request): Promise<void> {

        const cljSession = util.getSession('clj');
        const { id, key } = state.deref().get(DEBUG_RESPONSE_KEY);

        if (cljSession) {
            cljSession.sendDebugInput(':quit', id, key);
        }

        const cljReplWindow = replWindows['clj'];

        if (cljReplWindow) {
            cljReplWindow.stopDebugMode();
        }

        this.sendResponse(response);
    }

    protected terminateRequest(response: DebugProtocol.TerminateResponse, args: DebugProtocol.TerminateArguments, request?: DebugProtocol.Request): void {

        this.sendResponse(response);
    }

    protected customRequest(command: string, response: DebugProtocol.Response, args: any, request?: DebugProtocol.Request): void {

        switch (command) {
            case REQUESTS.SEND_TERMINATED_EVENT: {
                this.sendEvent(new TerminatedEvent());
                break;
            }
            case REQUESTS.SEND_STOPPED_EVENT: {
                this.sendEvent(new StoppedEvent(args.reason, CalvaDebugSession.THREAD_ID, args.exceptionText));
                break;
            }
        }

        this.sendResponse(response);
    }
}

CalvaDebugSession.run(CalvaDebugSession);

class CalvaDebugConfigurationProvider implements DebugConfigurationProvider {

	/**
	 * Massage a debug configuration just before a debug session is being launched,
	 * e.g. add all missing attributes to the debug configuration.
	 */
    resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {

        // If launch.json is missing or empty
        if (!config.type && !config.request && !config.name) {
            const editor = window.activeTextEditor;
            if (editor && editor.document.languageId === 'clojure') {
                config = { ...config, ...CALVA_DEBUG_CONFIGURATION };
            }
        }

        return config;
    }
}

class CalvaDebugAdapterDescriptorFactory implements DebugAdapterDescriptorFactory {

    private server?: Net.Server;

    createDebugAdapterDescriptor(session: DebugSession, executable: DebugAdapterExecutable | undefined): ProviderResult<DebugAdapterDescriptor> {

        if (!this.server) {
            // Start listening on a random port (0 means an arbitrary unused port will be used)
            this.server = Net.createServer(socket => {
                const debugSession = new CalvaDebugSession();
                debugSession.setRunAsServer(true);
                debugSession.start(<NodeJS.ReadableStream>socket, socket);
            }).listen(0);
        }

        // Make VS Code connect to debug server
        return new DebugAdapterServer(this.server.address().port);
    }

    dispose() {
        if (this.server) {
            this.server.close();
        }
    }
}

function handleNeedDebugInput(response: any): void {

    // Make sure the form exists in the editor and was not instrumented in the repl window
    if (typeof response.file === 'string'
        && typeof response.column === 'number'
        && typeof response.line === 'number') {

        state.cursor.set(DEBUG_RESPONSE_KEY, response);

        if (!debug.activeDebugSession) {
            debug.startDebugging(undefined, CALVA_DEBUG_CONFIGURATION);
        }
    } else {
        const cljSession = state.deref().get('clj');
        cljSession.sendDebugInput(':quit', response.id, response.key);
        vscode.window.showInformationMessage('Forms containing breakpoints that were not evaluated in the editor (such as if you evaluated a form in the REPL window) cannot be debugged. Evaluate the form in the editor in order to debug it.');
    }
}

debug.onDidStartDebugSession(session => {
    // We only start debugger sessions when a breakpoint is hit
    session.customRequest(REQUESTS.SEND_STOPPED_EVENT, { reason: 'breakpoint' });
});

export {
    CALVA_DEBUG_CONFIGURATION,
    REQUESTS,
    NEED_DEBUG_INPUT_STATUS,
    DEBUG_RESPONSE_KEY,
    CalvaDebugConfigurationProvider,
    CalvaDebugAdapterDescriptorFactory,
    handleNeedDebugInput
};