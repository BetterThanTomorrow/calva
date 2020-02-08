import { LoggingDebugSession, InitializedEvent } from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';

export class CalvaDebugSession extends LoggingDebugSession {
    public constructor() {
        super('calva-debug-logs.txt');
    }

    /**
	 * The 'initialize' request is the first request called by the frontend
	 * to interrogate the features the debug adapter provides.
	 */
    protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
        
        this.setDebuggerLinesStartAt1(args.linesStartAt1);
        this.setDebuggerColumnsStartAt1(args.columnsStartAt1);
        
        // Build and return the capabilities of this debug adapter
        response.body = { 
            ...response.body,
            supportsBreakpointLocationsRequest: true,
        };
        
        this.sendResponse(response);

        // Since this debug adapter can accept configuration requests like 'setBreakpoint' at any time,
		// we request them early by sending an 'initializeRequest' to the frontend.
		// The frontend will end the configuration sequence by calling 'configurationDone' request.
        this.sendEvent(new InitializedEvent());
    }

    protected attachRequest(response: DebugProtocol.AttachResponse, args: DebugProtocol.AttachRequestArguments) {
        console.log('ATTACH REQUEST RECEIVED');
        console.log('AttachResponse', response);

        this.sendResponse(response);
    }
}

CalvaDebugSession.run(CalvaDebugSession);