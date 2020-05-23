import * as vscode from 'vscode';
import * as child from 'child_process';

export interface  JackInTerminalOptions extends vscode.TerminalOptions {
    name: string,
    cwd: string,
    env: { [key: string]: string },
    executable: string,
    args: string[]
};

export class JackInTerminal implements vscode.Pseudoterminal {
    private writeEmitter = new vscode.EventEmitter<string>();
    onDidWrite: vscode.Event<string> = this.writeEmitter.event;
    private closeEmitter = new vscode.EventEmitter<void>();
    onDidClose?: vscode.Event<void> = this.closeEmitter.event;


    private fileWatcher: vscode.FileSystemWatcher | undefined;
    private process: child.ChildProcess;

    constructor(private options: JackInTerminalOptions, private outputChannel: vscode.OutputChannel, private whenStarted: (p: child.ChildProcess) => void) {
    }

    open(initialDimensions: vscode.TerminalDimensions | undefined): void {
        this.outputChannel.appendLine(`Starting Jack-in Terminal: ${this.options.executable} ${this.options.args.join(' ')}`);
        this.startClojureProgram();
    }

    close(): void {
        this.fileWatcher.dispose();
        if (this.process && !this.process.killed) {
            this.process.kill();
        }
    }

    private async startClojureProgram(): Promise<child.ChildProcess> {
        return new Promise<child.ChildProcess>((resolve) => {
            this.writeEmitter.fire(`${this.options.executable} ${this.options.args.join(' ')}\r\n`);
            if (this.process && !this.process.killed) {
                this.process.kill();
            }
            this.process = child.spawn(this.options.executable, this.options.args, {
                env: this.options.env,
                cwd: this.options.cwd,
                shell: true
            });
            this.whenStarted(this.process);
            this.process.on('exit', (status) => {
                this.writeEmitter.fire(`process exited with status: ${status}\r\n`);
            });
            this.process.stdout.on('data', (data) => {
                this.writeEmitter.fire(`${data}\r\n`);
            });
        });
    }
}