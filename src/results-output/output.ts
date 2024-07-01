import * as outputWindow from '../repl-window/repl-doc';
import * as config from '../config';
import * as vscode from 'vscode';
import * as util from '../utilities';
import * as model from '../cursor-doc/model';
import * as cursorUtil from '../cursor-doc/utilities';
import * as chalk from 'chalk';
import * as ansiRegex from 'ansi-regex';
import * as printer from '../printer';

const customChalk = new chalk.Instance({ level: 3 });

type OutputCategory = 'evalResults' | 'clojure' | 'evalOut' | 'evalErr' | 'otherOut' | 'otherErr';

type AppendOptions = {
  destination: OutputDestination;
  outputCategory: OutputCategory;
  after?: AfterAppendCallback;
};

type AppendClojureOptions = {
  ns?: string;
  replSessionType?: string;
};

const lightTheme = {
  evalSeparatorSessionType: customChalk.bgGreen,
  evalSeparatorNs: customChalk.bgBlue,
  evalOut: customChalk.gray,
  evalErr: customChalk.red,
  otherOut: customChalk.green,
  otherErr: customChalk.red,
};

const darkTheme = {
  evalSeparatorSessionType: customChalk.bgWhite,
  evalSeparatorNs: customChalk.bgWhiteBright,
  evalOut: customChalk.gray,
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

export type OutputDestination = 'repl-window' | 'output-channel' | 'terminal';

export type OutputDestinationConfiguration = {
  evalResults: OutputDestination;
  evalOutput: OutputDestination;
  otherOutput: OutputDestination;
};

export const defaultDestinationConfiguration: OutputDestinationConfiguration = {
  evalResults: 'repl-window',
  evalOutput: 'repl-window',
  otherOutput: 'repl-window',
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
    this.write(
      `This is not a ”real” terminal.
You can type into the terminal, but there is no process that will handle your input.

To reveal this terminal, use the command ${customChalk.bgWhiteBright.black(
        ' Calva: Show/Open the Calva Output Terminal '
      )}.

See also the Calva Inspector: https://calva.io/inspector

`
    );
  }
  write(message: string) {
    this.writeEmitter.fire(message.replace(/\r(?!\n)|(?<!\r)\n/g, '\r\n'));
  }
  close(): void {
    outputPTY = undefined;
    outputTerminal = undefined;
    // TODO: Decide if we should just recreate the terminal like this
    // getOutputPTY();
    // It would still be emptied, so the win isn't that big.
  }
}

let outputPTY: OutputTerminal;
let outputTerminal: vscode.Terminal;

function getOutputPTY() {
  if (!outputPTY) {
    outputPTY = new OutputTerminal();
    outputTerminal = vscode.window.createTerminal({ name: 'Calva Output', pty: outputPTY });
  }
  return outputPTY;
}

let outputChannel: vscode.OutputChannel;
export function initOutputChannel(channel: vscode.OutputChannel) {
  outputChannel = channel;
}

export function showOutputChannel(preserveFocus = true) {
  outputChannel.show(preserveFocus);
}

export function showOutputTerminal(preserveFocus = true) {
  if (!outputTerminal) {
    getOutputPTY();
  }
  outputTerminal.show(preserveFocus);
}

export function showResultOutputDestination(preserveFocus = true) {
  if (getDestinationConfiguration().evalResults === 'output-channel') {
    return showOutputChannel(preserveFocus);
  }
  if (getDestinationConfiguration().evalResults === 'terminal') {
    return showOutputTerminal(preserveFocus);
  }
  return outputWindow.revealResultsDoc(preserveFocus);
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

function messageContainsAnsi(message: string) {
  return ansiRegex().test(message);
}

// Used to decide if new result output should be prepended with a newline or not.
// Also: For non-result output, whether the repl window output should be be printed as line comments.
const didLastOutputTerminateLine: Record<OutputDestination, boolean> = {
  'repl-window': true,
  'output-channel': true,
  terminal: true,
};

let havePrintedLegacyReplWindowOutputMessage = false;

export function maybePrintLegacyREPLWindowOutputMessage() {
  if (
    !havePrintedLegacyReplWindowOutputMessage &&
    config.getConfig().outputDestinations.evalOutput === 'repl-window' &&
    !config.getConfig().legacyPrintBareReplWindowOutput
  ) {
    const message =
      '"Please see https://calva.io/output/#about-stdout-in-the-repl-window\nabout why stdout printed to this file is prepended with `;` to be line comments."';
    outputWindow.appendLine(message);
    havePrintedLegacyReplWindowOutputMessage = true;
  }
}

const lastInfoLineData: Record<OutputDestination, AppendClojureOptions> = {
  'repl-window': {},
  'output-channel': {},
  terminal: {},
};

function saveLastInfoLineData(destination: OutputDestination, options: AppendClojureOptions) {
  const { ns, replSessionType } = options;
  if (ns) {
    lastInfoLineData[destination] = { ns, replSessionType };
  }
}

function nsInfoLine(destination: OutputDestination, options: AppendClojureOptions) {
  return options.ns &&
    `${options.replSessionType}:${options.ns}` !==
      `${lastInfoLineData[destination].replSessionType}:${lastInfoLineData[destination].ns}`
    ? `\n;${themedChalk().evalSeparatorSessionType(
        ' ' + options.replSessionType + ' '
      )}${themedChalk().evalSeparatorNs(' ' + options.ns + ' ')}\n`
    : '\n';
}

function appendClojure(
  options: AppendOptions & AppendClojureOptions,
  message: string,
  after?: AfterAppendCallback
) {
  const destination = options.destination;
  const didLastTerminateLine = didLastOutputTerminateLine[destination];
  didLastOutputTerminateLine[destination] = true;
  if (destination === 'repl-window') {
    outputWindow.appendLine(`${didLastTerminateLine ? '' : '\n'}${message}`, after);
  } else if (destination === 'output-channel') {
    const doc = new model.StringDocument(message);
    const cursor = doc.getTokenCursor(0);
    const shouldFence =
      cursorUtil.hasMoreThanSingleSexp(doc) || cursorUtil.isRightSexpStructural(cursor);
    const outputMessage = shouldFence ? '```clojure\n' + message + '\n```' : message;
    outputChannel.appendLine((didLastTerminateLine ? '' : '\n') + outputMessage);
    if (after) {
      after(undefined, undefined);
    }
  } else if (destination === 'terminal') {
    const printerOptions = { ...printer.prettyPrintingOptions(), 'color?': true };
    const prettyMessage = printer.prettyPrint(message, printerOptions)?.value || message;
    // TODO: Figure if it's worth a setting to opt-in on an ns info line
    getOutputPTY().write(`${didLastTerminateLine ? '' : '\n'}${nsInfoLine(destination, options)}`);
    // getOutputPTY().write(`${didLastTerminateLine ? '' : '\n'}`);
    getOutputPTY().write(`${prettyMessage}\n`);
    if (after) {
      after(undefined, undefined);
    }
  }
  saveLastInfoLineData(destination, options);
}

/**
 * Appends evaluation related Clojure code.
 * Prepending with newline if last output did not end with a newline.
 * Fencing in a `clojure` markdown block if destination is `output-channel`.
 * @param code The code to append
 * @param after Optional callback to run after the append
 */
export function appendClojureEval(
  code: string,
  options: AppendClojureOptions,
  after?: AfterAppendCallback
) {
  const destination = getDestinationConfiguration().evalResults;
  appendClojure({ destination, outputCategory: 'evalResults', ...options }, code, after);
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
  appendClojure({ destination, outputCategory: 'clojure' }, message, after);
}

function append(options: AppendOptions, message: string, after?: AfterAppendCallback) {
  const destination = options.destination;
  const didLastTerminateLine = didLastOutputTerminateLine[destination];
  didLastOutputTerminateLine[destination] = util.stripAnsi(message).endsWith('\n');
  if (destination === 'repl-window') {
    const decoratedMessage =
      options.outputCategory === 'evalOut' && config.getConfig().legacyPrintBareReplWindowOutput
        ? message
        : `${didLastTerminateLine ? '; ' : ''}${asClojureLineComments(util.stripAnsi(message))}`;
    outputWindow.append(decoratedMessage, after);
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
    getOutputPTY().write(`${message}`);
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
  const coloredMessage =
    destinationSupportsAnsi(destination) && !messageContainsAnsi(message)
      ? themedChalk().evalOut(message)
      : message;
  append({ destination, outputCategory: 'evalOut' }, coloredMessage, after);
}

/**
 * Appends output without adding a newline at the end.
 * Use for stderr messages related to an evaluation
 * @param message The message to append
 * @param after Optional callback to run after the append
 */
export function appendEvalErr(
  message: string,
  options: AppendClojureOptions,
  after?: AfterAppendCallback
) {
  const destination = getDestinationConfiguration().evalOutput;
  const coloredMessage =
    destinationSupportsAnsi(destination) && !messageContainsAnsi(message)
      ? themedChalk().evalErr(message)
      : message;
  // TODO: Figure if it's worth a setting to opt-in on an ns info line
  append({ destination, outputCategory: 'evalErr' }, nsInfoLine(destination, options));
  append({ destination, outputCategory: 'evalErr' }, coloredMessage, after);
  saveLastInfoLineData(destination, options);
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
  const coloredMessage =
    destinationSupportsAnsi(destination) && !messageContainsAnsi(message)
      ? themedChalk().otherOut(message)
      : message;
  append({ destination, outputCategory: 'otherOut' }, coloredMessage, after);
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
  const coloredMessage =
    destinationSupportsAnsi(destination) && !messageContainsAnsi(message)
      ? themedChalk().otherErr(message)
      : message;
  append({ destination, outputCategory: 'otherErr' }, coloredMessage, after);
}

function appendLine(options: AppendOptions, message: string, after?: AfterAppendCallback) {
  const destination = options.destination;
  const didLastTerminateLine = didLastOutputTerminateLine[destination];
  didLastOutputTerminateLine[destination] = true;
  if (destination === 'repl-window') {
    const decoratedMessage =
      options.outputCategory === 'evalOut' && config.getConfig().legacyPrintBareReplWindowOutput
        ? message
        : `${didLastTerminateLine ? '; ' : ''}${asClojureLineComments(util.stripAnsi(message))}`;
    outputWindow.appendLine(decoratedMessage, after);
    return;
  }
  if (destination === 'output-channel') {
    outputChannel.appendLine(message);
    return;
  }
  if (destination === 'terminal') {
    append(options, message + '\r\n', after);
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
  const coloredMessage =
    destinationSupportsAnsi(destination) && !messageContainsAnsi(message)
      ? themedChalk().evalOut(message)
      : message;
  appendLine({ destination, outputCategory: 'evalOut' }, coloredMessage, after);
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
  const coloredMessage =
    destinationSupportsAnsi(destination) && !messageContainsAnsi(message)
      ? themedChalk().evalErr(message)
      : message;
  appendLine({ destination, outputCategory: 'evalErr' }, coloredMessage, after);
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
  const coloredMessage =
    destinationSupportsAnsi(destination) && !messageContainsAnsi(message)
      ? themedChalk().otherOut(message)
      : message;
  appendLine({ destination, outputCategory: 'otherOut' }, coloredMessage, after);
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
  const coloredMessage =
    destinationSupportsAnsi(destination) && !messageContainsAnsi(message)
      ? themedChalk().otherErr(message)
      : message;
  appendLine({ destination, outputCategory: 'otherErr' }, coloredMessage, after);
}

/**
 * Appends a prompt to the repl window.
 * Needs to be called via here, because we keep track of wether the last output ended with a newline or not.
 * @param onAppended Optional callback to run after the append
 */
export function replWindowAppendPrompt(onAppended?: outputWindow.OnAppendedCallback) {
  didLastOutputTerminateLine['output-window'] = true;
  outputWindow.appendPrompt(onAppended);
}
