import * as outputWindow from '../repl-window/repl-doc';
import * as config from '../config';
import * as vscode from 'vscode';
import * as util from '../utilities';
import * as model from '../cursor-doc/model';
import * as cursorUtil from '../cursor-doc/utilities';
import * as chalk from 'chalk';
import * as printer from '../printer';

const customChalk = new chalk.Instance({ level: 3 });

const lightTheme = {
  evalOut: customChalk.gray,
  evalErr: customChalk.red,
  otherOut: customChalk.green,
  otherErr: customChalk.red,
};

const darkTheme = {
  evalOut: customChalk.grey,
  evalErr: customChalk.redBright,
  otherOut: customChalk.grey,
  otherErr: customChalk.redBright,
};

function themedChalk() {
  return vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light
    ? lightTheme
    : darkTheme;
}

export interface AfterAppendCallback {
  (insertLocation: vscode.Location, newPosition?: vscode.Location): any;
}

let outputChannel: vscode.OutputChannel;
export function initOutputChannel(channel: vscode.OutputChannel) {
  outputChannel = channel;
}

export function showOutputChannel() {
  outputChannel.show(true);
}

export function showOutputTerminal() {
  outputTerminal.show(true);
}

export type OutputDestination = 'repl-window' | 'output-channel' | 'terminal';

export type OutputDestinationConfiguration = {
  evalResults: OutputDestination;
  evalOutput: OutputDestination;
  otherOutput: OutputDestination;
  pseudoTerminal: OutputDestination;
};

export const defaultDestinationConfiguration: OutputDestinationConfiguration = {
  evalResults: 'output-channel',
  evalOutput: 'output-channel',
  otherOutput: 'output-channel',
  pseudoTerminal: 'terminal',
};

class OutputTerminal implements vscode.Pseudoterminal {
  private writeEmitter = new vscode.EventEmitter<string>();
  onDidWrite: vscode.Event<string> = this.writeEmitter.event;
  handleInput(data: string): void {
    if (data === '\r') {
      return this.writeEmitter.fire('\r\n');
    }
    this.writeEmitter.fire(data);
  }
  open(_initialDimensions: vscode.TerminalDimensions | undefined): void {
    this.writeEmitter.fire(
      'This is a pseudo terminal.\nNB: The contents of this terminal will not survive reloads of the VS Code window.\nYou can type here, but there is no process that will handle your input.\n'
    );
  }
  write(message: string) {
    this.writeEmitter.fire(message.replace(/\r(?!\n)|(?<!\r)\n/g, '\r\n'));
  }
  close(): void {
    // There's nothing to clean up.
  }
}

let outputPTY: OutputTerminal;
let outputTerminal: vscode.Terminal;

function getTerminal() {
  if (!outputPTY) {
    outputPTY = new OutputTerminal();
    outputTerminal = vscode.window.createTerminal({ name: 'Calva Output', pty: outputPTY });
  }
  return outputPTY;
}

export function showResultOutputDestination() {
  if (getDestinationConfiguration().evalResults === 'output-channel') {
    return showOutputChannel();
  }
  if (getDestinationConfiguration().evalResults === 'terminal') {
    if (!outputTerminal) {
      getTerminal();
    }
    return showOutputTerminal();
  }
  return outputWindow.revealResultsDoc(true);
}

export function getDestinationConfiguration(): OutputDestinationConfiguration {
  return config.getConfig().outputDestinations || defaultDestinationConfiguration;
}

function asClojureLineComments(message: string) {
  return message.replace(/\n(?!$)/g, '\n; ');
}

function destinationSupportsAnsi(destination: OutputDestination) {
  return destination === 'terminal';
}

// Used to decide if new result output should be prepended with a newline or not.
// Also: For non-result output, whether the repl window output should be be printed as line comments.
const didLastOutputTerminateLine: Record<OutputDestination, boolean> = {
  'repl-window': true,
  'output-channel': true,
  terminal: true,
};

function appendClojure(
  destination: OutputDestination,
  message: string,
  after?: AfterAppendCallback
) {
  const didLastTerminateLine = didLastOutputTerminateLine[destination];
  didLastOutputTerminateLine[destination] = true;
  if (destination === 'repl-window') {
    outputWindow.appendLine(`${didLastTerminateLine ? '' : '\n'}${message}`, after);
    return;
  }
  if (destination === 'output-channel') {
    const doc = new model.StringDocument(message);
    const cursor = doc.getTokenCursor(0);
    const shouldFence =
      cursorUtil.hasMoreThanSingleSexp(doc) || cursorUtil.isRightSexpStructural(cursor);
    const outputMessage = shouldFence ? '```clojure\n' + message + '\n```' : message;
    outputChannel.appendLine((didLastTerminateLine ? '' : '\n') + outputMessage);
    if (after) {
      after(undefined, undefined);
    }
    return;
  }
  if (destination === 'terminal') {
    const printerOptions = { ...printer.prettyPrintingOptions(), 'color?': true };
    const prettyMessage = printer.prettyPrint(message, printerOptions)?.value || message;
    getTerminal().write(`${didLastTerminateLine ? '' : '\r\n'}${prettyMessage}\r\n`);
    if (after) {
      after(undefined, undefined);
    }
    return;
  }
}

/**
 * Appends evaluation related Clojure code.
 * Prepending with newline if last output did not end with a newline.
 * Fencing in a `clojure` markdown block if destination is `output-channel`.
 * @param code The code to append
 * @param after Optional callback to run after the append
 */
export function appendClojureEval(code: string, after?: AfterAppendCallback) {
  const destination = getDestinationConfiguration().evalResults;
  appendClojure(destination, code, after);
}

/**
 * Appends evaluation related Clojure code.
 * Prepending with newline if last output did not end with a newline.
 * Fencing in a `clojure` markdown block if destination is `output-channel`.
 * @param code The code to append
 * @param after Optional callback to run after the append
 */
export function appendClojureOther(message: string, after?: AfterAppendCallback) {
  const destination = getDestinationConfiguration().otherOutput;
  appendClojure(destination, message, after);
}

function append(destination: OutputDestination, message: string, after?: AfterAppendCallback) {
  const didLastTerminateLine = didLastOutputTerminateLine[destination];
  didLastOutputTerminateLine[destination] = message.endsWith('\n');
  if (destination === 'repl-window') {
    outputWindow.append(
      `${didLastTerminateLine ? '; ' : ''}${asClojureLineComments(util.stripAnsi(message))}`,
      after
    );
    return;
  }
  if (destination === 'output-channel') {
    outputChannel.append(util.stripAnsi(message));
    if (after) {
      after(undefined, undefined);
    }
    return;
  }
  if (destination === 'terminal') {
    getTerminal().write(`${message}`);
    if (after) {
      after(undefined, undefined);
    }
    return;
  }
}

/**
 * Appends output without adding a newline at the end.
 * Use for stdout messages related to an evaluation
 * @param message The message to append
 * @param after Optional callback to run after the append
 */
export function appendEvalOut(message: string, after?: AfterAppendCallback) {
  const destination = getDestinationConfiguration().evalOutput;
  const coloredMessage = destinationSupportsAnsi(destination)
    ? themedChalk().evalOut(message)
    : message;
  append(destination, coloredMessage, after);
}

/**
 * Appends output without adding a newline at the end.
 * Use for stderr messages related to an evaluation
 * @param message The message to append
 * @param after Optional callback to run after the append
 */
export function appendEvalErr(message: string, after?: AfterAppendCallback) {
  const destination = getDestinationConfiguration().evalOutput;
  const coloredMessage = destinationSupportsAnsi(destination)
    ? themedChalk().evalErr(message)
    : message;
  append(destination, coloredMessage, after);
}

/**
 * Appends output without adding a newline at the end.
 * Use for stdout and other messages not related to an evaluation
 * (e.g. out of band messages)
 * @param message The message to append
 * @param after Optional callback to run after the append
 */
export function appendOtherOut(message: string, after?: AfterAppendCallback) {
  const destination = getDestinationConfiguration().otherOutput;
  const coloredMessage = destinationSupportsAnsi(destination)
    ? themedChalk().otherOut(message)
    : message;
  append(destination, coloredMessage, after);
}

/**
 * Appends output without adding a newline at the end.
 * Use for stderr and other error messages not related to an evaluation
 * (e.g. out of band messages)
 * @param message The message to append
 * @param after Optional callback to run after the append
 */
export function appendOtherErr(message: string, after?: AfterAppendCallback) {
  const destination = getDestinationConfiguration().otherOutput;
  const coloredMessage = destinationSupportsAnsi(destination)
    ? themedChalk().otherErr(message)
    : message;
  append(destination, coloredMessage, after);
}

function appendLine(destination: OutputDestination, message: string, after?: AfterAppendCallback) {
  const didLastTerminateLine = didLastOutputTerminateLine[destination];
  didLastOutputTerminateLine[destination] = true;
  if (destination === 'repl-window') {
    outputWindow.appendLine(
      `${didLastTerminateLine ? '; ' : ''}${asClojureLineComments(util.stripAnsi(message))}`,
      after
    );
    return;
  }
  if (destination === 'output-channel') {
    outputChannel.appendLine(message);
    return;
  }
  if (destination === 'terminal') {
    append(destination, message + '\r\n', after);
  }
}

/**
 * Appends output adding a newline at the end.
 * Use for stdout messages related to an evaluation
 * (Maybe there is no use case for this even, as all eval output already should have any newlines needed)
 * @param message The message to append
 * @param after Optional callback to run after the append
 */
export function appendLineEvalOut(message: string, after?: AfterAppendCallback) {
  const destination = getDestinationConfiguration().evalOutput;
  const coloredMessage = destinationSupportsAnsi(destination)
    ? themedChalk().evalOut(message)
    : message;
  appendLine(destination, coloredMessage, after);
}

/**
 * Appends output adding a newline at the end.
 * Use for stderr messages related to an evaluation
 * (Maybe there is no use case for this even, as all eval output already should have any newlines needed)
 * @param message The message to append
 * @param after Optional callback to run after the append
 */
export function appendLineEvalErr(message: string, after?: AfterAppendCallback) {
  const destination = getDestinationConfiguration().evalOutput;
  const coloredMessage = destinationSupportsAnsi(destination)
    ? themedChalk().evalErr(message)
    : message;
  appendLine(destination, coloredMessage, after);
}

/**
 * Appends output adding a newline at the end.
 * Use for stdout and other messages not related to an evaluation
 * (e.g. out of band messages)
 * @param message The message to append
 * @param after Optional callback to run after the append
 */
export function appendLineOtherOut(message: string, after?: AfterAppendCallback) {
  const destination = getDestinationConfiguration().otherOutput;
  const coloredMessage = destinationSupportsAnsi(destination)
    ? themedChalk().otherOut(message)
    : message;
  appendLine(destination, coloredMessage, after);
}

/**
 * Appends output adding a newline at the end.
 * Use for stderr and other error messages not related to an evaluation
 * (e.g. out of band messages)
 * @param message The message to append
 * @param after Optional callback to run after the append
 */
export function appendLineOtherErr(message: string, after?: AfterAppendCallback) {
  const destination = getDestinationConfiguration().otherOutput;
  const coloredMessage = destinationSupportsAnsi(destination)
    ? themedChalk().otherErr(message)
    : message;
  appendLine(destination, coloredMessage, after);
}

/**
 * Appends a prompt to the output window.
 * Needs to be called via here, because we keep track of wether the last output ended with a newline or not.
 * @param onAppended Optional callback to run after the append
 */
export function replWindowAppendPrompt(onAppended?: outputWindow.OnAppendedCallback) {
  didLastOutputTerminateLine['output-window'] = true;
  outputWindow.appendPrompt(onAppended);
}
