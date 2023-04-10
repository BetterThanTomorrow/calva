import * as vscode from 'vscode';
import * as child from 'child_process';
import * as kill from 'tree-kill';
import * as outputWindow from '../results-output/results-doc';

export interface JackInTerminalOptions extends vscode.TerminalOptions {
  name: string;
  cwd: string;
  env: { [key: string]: string };
  executable: string;
  args: string[];
  isWin: boolean;
  useShell: boolean;
}

export function createCommandLine(options: JackInTerminalOptions): string {
  const commandSeparator = options.isWin ? '&' : ';';
  return `pushd ${options.cwd} ${commandSeparator} ${options.executable} ${options.args.join(
    ' '
  )} ${commandSeparator} popd`;
}

export class JackInTerminal implements vscode.Pseudoterminal {
  private writeEmitter = new vscode.EventEmitter<string>();
  onDidWrite: vscode.Event<string> = this.writeEmitter.event;
  private closeEmitter = new vscode.EventEmitter<void>();
  onDidClose: vscode.Event<void> = this.closeEmitter.event;

  private process: child.ChildProcess;

  constructor(
    private options: JackInTerminalOptions,
    private whenREPLStarted: (p: child.ChildProcess, host: string, port: string) => void,
    private whenError: (errorMessage: string) => void
  ) {}

  open(initialDimensions: vscode.TerminalDimensions | undefined): void {
    outputWindow.appendLine(`; Starting Jack-in Terminal: ${createCommandLine(this.options)}`);
    this.writeEmitter.fire(
      'This is a pseudo terminal, only used for hosting the Jack-in REPL process. It takes no input.\r\nPressing ctrl+c with this terminal focused, killing this terminal, or closing/reloading the VS Code window will all stop/kill the Jack-in REPL process.\r\n\r\n'
    );
    void this.startClojureProgram();
  }

  close(): void {
    this.killProcess();
    this.closeEmitter.fire();
  }

  handleInput(data: string) {
    const charCode = data.charCodeAt(0);
    if (data === '\r') {
      this.writeEmitter.fire('\r\n');
    } else if (charCode < 32) {
      this.writeEmitter.fire(`^${String.fromCharCode(charCode + 64)}`);
      if (charCode === 3) {
        this.killProcess();
      }
    } else {
      this.writeEmitter.fire(`${data}`);
    }
  }

  private dataToString(data: string | Buffer) {
    return data.toString().replace(/\r?\n/g, '\r\n').replace(/\r\n$/, '');
  }

  private async startClojureProgram(): Promise<child.ChildProcess> {
    return new Promise<child.ChildProcess>(() => {
      const data = `${createCommandLine(this.options)}\r\n`;
      this.writeEmitter.fire('⚡️ Starting the REPL ⚡️ using the below command line:\r\n');
      this.writeEmitter.fire(data);
      if (this.process && !this.process.killed) {
        console.log('Restarting Jack-in process');
        this.killProcess();
      }
      this.process = child.spawn(this.options.executable, this.options.args, {
        env: this.options.env,
        cwd: this.options.cwd,
        shell: this.options.useShell,
      });
      this.process.on('exit', (status) => {
        this.writeEmitter.fire(`Jack-in process exited. Status: ${status}\r\n`);
      });
      this.process.stdout.on('data', (data) => {
        const msg = this.dataToString(data);
        this.writeEmitter.fire(`${msg}\r\n`);
        // Started nREPL server at 127.0.0.1:1337
        // nREPL server started on port 61419 on host localhost - nrepl://localhost:61419
        // shadow-cljs - nREPL server started on port 3333
        // nbb - nRepl server started on port %d . nrepl-cljs-sci version %s 1337 TODO
        // TODO: Remove nbb WIP match
        if (msg.match(/Started nREPL server|nREPL server started/i)) {
          const [_, port1, host1, host2, port2, port3] = msg.match(
            /(?:Started nREPL server|nREPL server started)[^\r\n]+?(?:(?:on port (\d+)(?: on host (\S+))?)|([^\s/]+):(\d+))|.*?(\d+) TODO/
          );
          this.whenREPLStarted(
            this.process,
            host1 ? host1 : host2 ? host2 : 'localhost',
            port1 ? port1 : port2 ? port2 : port3
          );
        }
      });
      this.process.stderr.on('data', (data) => {
        const msg = this.dataToString(data);
        this.writeEmitter.fire(`${msg}\r\n`);
      });
    });
  }

  killProcess(): void {
    console.log('Jack-in process kill requested');
    if (this.process && !this.process.killed) {
      this.writeEmitter.fire('🛑 Stopping/killing the Jacked-in REPL process... 🛑\r\n');
      console.log('Jack-in terminal killProcess(): Closing any ongoing stdin event');
      this.process.stdin.end(() => {
        // On some machines we need to use tree-kill to kill the process, so we do it always
        // https://github.com/BetterThanTomorrow/calva/issues/2116
        console.log('Jack-in terminal killProcess(): Killing process using tree-kill');
        kill(this.process.pid, 'SIGTERM', (err) => {
          if (err) {
            console.log('Jack-in terminal killProcess(): Error killing process', err);
          }
          // The test for this.process.killed above needs this to have happened too
          this.process.kill();
        });
      });
    } else if (this.process && this.process.killed) {
      this.writeEmitter.fire(
        'The Jacked-in REPL process is already killed. Jack-in again to start a new REPL.\r\n'
      );
      console.log('Jack-in terminal killProcess(): The Jacked-in REPL process is already killed.');
    }
  }
}
