import { LoggingDebugSession, InitializedEvent, TerminatedEvent } from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import { debug, window, DebugConfigurationProvider, WorkspaceFolder, DebugConfiguration, CancellationToken, ProviderResult, DebugAdapterDescriptorFactory, DebugAdapterDescriptor, DebugSession, DebugAdapterExecutable, DebugAdapterServer } from 'vscode';
import * as util from './utilities';
import * as Net from 'net';
import * as state from './state';

const CALVA_DEBUG_CONFIGURATION: DebugConfiguration = {
    type: 'clojure',
    name: 'Calva Debug',
    request: 'attach'
};

class CalvaDebugSession extends LoggingDebugSession {
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
            ...response.body,
            supportsBreakpointLocationsRequest: true,
        };
        
        this.sendResponse(response);

        // Since this debug adapter can accept configuration requests like 'setBreakpoint' at any time,
		// we request them early by sending an 'initializeRequest' to the frontend.
		// The frontend will end the configuration sequence by calling 'configurationDone' request.
        this.sendEvent(new InitializedEvent());
    }

    protected async attachRequest(response: DebugProtocol.AttachResponse, args: DebugProtocol.AttachRequestArguments): Promise<void> {
		
        this.sendResponse(response);
	}
	
	protected async disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments, request?: DebugProtocol.Request): Promise<void> {

		const cljSession = util.getSession('clj');

		if (cljSession) {
			cljSession.sendDebugInput('quit');
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
				config = {...config, ...CALVA_DEBUG_CONFIGURATION};
			}
		}

		return config;
	}
}

class CalvaDebugAdapterDescriptorFactory implements DebugAdapterDescriptorFactory {

	private server?: Net.Server;

	createDebugAdapterDescriptor(session: DebugSession, executable: DebugAdapterExecutable | undefined): ProviderResult<DebugAdapterDescriptor> {

		if (!this.server) {
			// start listening on a random port (0 means an arbitrary unused port will be used)
			this.server = Net.createServer(socket => {
				const debugSession = new CalvaDebugSession();
				debugSession.setRunAsServer(true);
				debugSession.start(<NodeJS.ReadableStream>socket, socket);
			}).listen(0);
		}

		// make VS Code connect to debug server
		return new DebugAdapterServer(this.server.address().port);
	}

	dispose() {
		if (this.server) {
			this.server.close();
		}
	}
}

function handleDebugResponse(response: any): boolean {
	state.cursor.set('debug-response', response);
	
	if (!debug.activeDebugSession) {
		debug.startDebugging(undefined, CALVA_DEBUG_CONFIGURATION);
	}

	return false;
}

export {
    CALVA_DEBUG_CONFIGURATION,
    CalvaDebugConfigurationProvider,
	CalvaDebugAdapterDescriptorFactory,
	handleDebugResponse
};