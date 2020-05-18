import * as path from 'path';
import * as vscode from 'vscode';
import { ReplConnectSequence } from './connectSequence';
import * as child from 'child_process';

export interface JackInTaskDefinition extends vscode.TaskDefinition {
    executable: string;
    execution?: vscode.ProcessExecution | vscode.ShellExecution;
    cljTypes?: string[],
    outputChannel?: vscode.OutputChannel,
    connectSequence?: ReplConnectSequence
}

export class JackInTaskProvider implements vscode.TaskProvider {
    static JackInType: string = 'JackInTask';
    private tasks: vscode.Task[] | undefined;
    private sharedState: string | undefined;

    constructor(private workspaceRoot: string) { }

    public async provideTasks(): Promise<vscode.Task[]> {
        return this.getTasks();
    }

    public resolveTask(_task: vscode.Task): vscode.Task | undefined {
        const definition: JackInTaskDefinition = <any>_task.definition;
        return this.getTask(definition.executable, definition.execution, definition, definition.cljTypes, definition.outputChannel, definition.connectSequence);
    }

    private getTasks(): vscode.Task[] {
        // if (this.tasks !== undefined) {
        //     return this.tasks;
        // }
        // const flavors: string[] = ['32', '64'];
        // const flags: string[][] = [['watch', 'incremental'], ['incremental'], []];

        // this.tasks = [];
        // flavors.forEach(flavor => {
        //     flags.forEach(flagGroup => {
        //         this.tasks!.push(this.getTask(flavor, flagGroup));
        //     });
        // });
        return this.tasks;
    }

    private getTask(executable: string, execution: vscode.ProcessExecution | vscode.ShellExecution, definition?: JackInTaskDefinition, cljTypes?: string[], outputChannel?: vscode.OutputChannel, connectSequence?: ReplConnectSequence): vscode.Task {
        if (definition === undefined) {
            definition = {
                type: JackInTaskProvider.JackInType,
                executable,
                execution,
                cljTypes,
                outputChannel,
                connectSequence
            };
        }
        return new vscode.Task(definition, vscode.TaskScope.Workspace, `${executable}`,
            JackInTaskProvider.JackInType, new vscode.CustomExecution(async (): Promise<vscode.Pseudoterminal> => {
                // When the task is executed, this callback will run. Here, we setup for running the task.
                return new JackInTaskTerminal(this.workspaceRoot, executable, execution, cljTypes, outputChannel, connectSequence);
            }));
    }
}

class JackInTaskTerminal implements vscode.Pseudoterminal {
    private writeEmitter = new vscode.EventEmitter<string>();
    onDidWrite: vscode.Event<string> = this.writeEmitter.event;
    private closeEmitter = new vscode.EventEmitter<void>();
    onDidClose?: vscode.Event<void> = this.closeEmitter.event;

    private fileWatcher: vscode.FileSystemWatcher | undefined;
    private process: child.ChildProcess;

    constructor(private workspaceRoot: string, private executable: string, private execution: vscode.ProcessExecution | vscode.ShellExecution, private cljTypes: string[], private outputChannel: vscode.OutputChannel, private connectSequence: ReplConnectSequence) {
    }

    open(initialDimensions: vscode.TerminalDimensions | undefined): void {
        // At this point we can start using the terminal.
        // if (this.flags.indexOf('watch') > -1) {
        //     let pattern = path.join(this.workspaceRoot, 'JackInFile');
        //     this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
        //     this.fileWatcher.onDidChange(() => this.doBuild());
        //     this.fileWatcher.onDidCreate(() => this.doBuild());
        //     this.fileWatcher.onDidDelete(() => this.doBuild());
        // }
        this.doBuild();
    }

    close(): void {
        this.fileWatcher.dispose();
        if (this.process && !this.process.killed) {
            this.process.kill();
        }
    }

    private async doBuild(): Promise<void> {
        return new Promise<void>((resolve) => {
            this.writeEmitter.fire(`${this.executable} ${this.execution.args.join(' ')}\r\n`);
            if (this.process && !this.process.killed) {
                this.process.kill();
            }
            this.process = child.spawn(this.executable, this.execution.args as string[], {
                env: this.execution.options.env,
                cwd: this.execution.options.cwd,
                shell: this.execution instanceof vscode.ShellExecution
            });
            this.process.on('exit', (status) => {
                this.writeEmitter.fire(`process exited with status: ${status}\r\n`);
            });
            this.process.stdout.on('data', (data) => {
                this.writeEmitter.fire(`${data}\r\n`);
            });


            // setTimeout(() => {
            //     const date = new Date();
            //     this.setSharedState(date.toTimeString() + ' ' + date.toDateString());
            //     this.writeEmitter.fire('Build complete.\r\n\r\n');
            //     if (this.flags.indexOf('watch') === -1) {
            //         this.closeEmitter.fire();
            //         resolve();
            //     }
            // }, isIncremental ? 1000 : 4000);
        });
    }
}