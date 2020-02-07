import { LoggingDebugSession } from 'vscode-debugadapter';

export class CalvaDebugSession extends LoggingDebugSession {
    public constructor() {
        super('calva-debug-logs.txt');

        this.setDebuggerLinesStartAt1(false);
        this.setDebuggerColumnsStartAt1(false);
    }
}

CalvaDebugSession.run(CalvaDebugSession);