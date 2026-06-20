import * as outputWindow from '../repl-window/repl-window-doc';
import * as config from '../config';
import * as vscode from 'vscode';
import * as util from '../utilities';
import * as model from '../cursor-doc/model';
import * as cursorUtil from '../cursor-doc/utilities';
import * as chalk from 'chalk';
import ansiRegex = require('ansi-regex');
import * as printer from '../printer';
import * as cljsLib from '../../out/cljs-lib/cljs-lib';
import * as replSession from '../nrepl/repl-session';
import * as jackInVersions from '../nrepl/jack-in-dependency-versions';
import * as evaluatedCode from './evaluated-code';

const customChalk = new chalk.Instance({ level: 3 });

export interface SubscriberOutputMessage {
  category: OutputCategory;
  text: string;
  who?: string;
  ns?: string;
  replSessionKey?: string;
  shadowBuild?: string;
  shadowRuntimeId?: number;
}

type Listener = (msg: SubscriberOutputMessage) => void;
const listeners = new Set<Listener>();

/**
 * Subscribe to every emitted output message. Returns an unsubscribe fn.
 */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(msg: SubscriberOutputMessage) {
  for (const listener of listeners) {
    listener(msg);
  }
}

/**
 * Emit a message to subscribers only, without writing to any UI destinations.
 * Used by the API `log()` function for external extensions.
 */
export function emitExternal(msg: SubscriberOutputMessage) {
  emit(msg);
}

export type OutputCategory =
  | 'evalResults'
  | 'evaluatedCode'
  | 'clojure'
  | 'evalOut'
  | 'evalErr'
  | 'otherOut'
  | 'otherErr';

type AppendOptions = {
  destination: string;
  outputCategory: OutputCategory;
  after?: AfterAppendCallback;
  who?: string;
  ns?: string;
  replSessionKey?: string;
  shadowBuild?: string;
  shadowRuntimeId?: number;
};

export type AppendClojureOptions = {
  ns?: string;
  replSessionType?: string;
  outputCategory?: OutputCategory;
  who?: string;
  description?: string;
  shadowBuild?: string;
  shadowRuntimeId?: number;
};

export type AppendEvaluatedCodeOptions = {
  destination: OutputDestinationValue;
  additionalDestinations?: OutputDestinationValue[];
  sinkDestination?: OutputDestinationValue;
  writeVisible?: boolean;
  visibleOutputCategory?: OutputCategory;
  ns?: string;
  replSessionType?: string;
  who?: string;
  shadowBuild?: string;
  shadowRuntimeId?: number;
};

const lightTheme = {
  evalSeparatorSessionType: customChalk.bgGreen,
  evalSeparatorNs: customChalk.bgBlue,
  evalSeparatorWho: customChalk.bgCyan,
  evalOut: customChalk.gray,
  evalErr: customChalk.red,
  otherOut: customChalk.green,
  otherErr: customChalk.red,
};

const darkTheme = {
  evalSeparatorSessionType: customChalk.bgWhite,
  evalSeparatorNs: customChalk.bgWhiteBright,
  evalSeparatorWho: customChalk.bgCyanBright,
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

import * as outputDestinations from './output-destinations';
import * as fileOutput from './file-output';

type OutputDestination = outputDestinations.OutputDestination;
type OutputDestinationValue = outputDestinations.OutputDestinationValue;

const normalizeDestinations = outputDestinations.normalizeDestinations;
const isFilePathDestination = fileOutput.isFilePathDestination;
const resolveOutputFilePath = fileOutput.resolveOutputFilePath;
const appendToOutputFile = fileOutput.appendToOutputFile;
const reportFileOutputError = fileOutput.reportFileOutputError;

export type { OutputDestination, OutputDestinationValue };
export { normalizeDestinations };

export type OutputDestinationConfiguration = {
  evalResults: OutputDestinationValue;
  evalOutput: OutputDestinationValue;
  otherOutput: OutputDestinationValue;
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

${jackInVersions.formatEffectiveVersionsReport()}

${jackInVersions.formatLatestVersionsReport()}

Please consider sponsoring Calva: https://calva.io/sponsors ♥️

`
    );
  }
  write(message: string) {
    this.writeEmitter.fire(message.replace(/\r?\n/g, '\r\n'));
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
  const destinations = normalizeDestinations(getDestinationConfiguration().evalResults);
  const first = destinations[0];
  if (!first) {
    return;
  }
  if (isFilePathDestination(first)) {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const resolvedPath = resolveOutputFilePath(first, workspaceRoot);
    if (resolvedPath) {
      return vscode.window.showTextDocument(vscode.Uri.file(resolvedPath), {
        preserveFocus,
        preview: true,
      });
    }
    return;
  }
  if (first === 'output-channel') {
    return showOutputChannel(preserveFocus);
  }
  if (first === 'terminal') {
    return showOutputTerminal(preserveFocus);
  }
  if (first === 'output-view') {
    return cljsLib.showReplOutputWebviewPanel(preserveFocus);
  }
  return outputWindow.revealReplWindowDoc(preserveFocus);
}

export function getDestinationConfiguration(): OutputDestinationConfiguration {
  const raw = config.getConfig().outputDestinations;
  return raw || defaultDestinationConfiguration;
}

function asClojureLineComments(message: string) {
  return message.replace(/\n(?!$)/g, '\n; ');
}

function destinationSupportsAnsi(destination: string) {
  return destination === 'terminal';
}

function messageContainsAnsi(message: string) {
  return ansiRegex().test(message);
}

function writeToFileDestination(
  destination: string,
  message: string,
  after?: AfterAppendCallback
): void {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const resolvedPath = resolveOutputFilePath(destination, workspaceRoot);
  if (!resolvedPath) {
    reportFileOutputError(
      destination,
      new Error(`Cannot resolve file path: ${destination}`),
      (msg) => void vscode.window.showErrorMessage(msg)
    );
    if (after) {
      after(undefined, undefined);
    }
    return;
  }
  const stripped = util.stripAnsi(message);
  appendToOutputFile(resolvedPath, stripped).catch((err) => {
    reportFileOutputError(destination, err, (msg) => void vscode.window.showErrorMessage(msg));
  });
  if (after) {
    after(undefined, undefined);
  }
}

// Used to decide if new result output should be prepended with a newline or not.
// Also: For non-result output, whether the repl window output should be printed as line comments.
const didLastOutputTerminateLine = new Map<string, boolean>([
  ['repl-window', true],
  ['output-channel', true],
  ['terminal', true],
  ['output-view', true],
]);

let havePrintedLegacyReplWindowOutputMessage = false;

export function maybePrintLegacyREPLWindowOutputMessage() {
  if (
    !havePrintedLegacyReplWindowOutputMessage &&
    normalizeDestinations(config.getConfig().outputDestinations.evalOutput).includes(
      'repl-window'
    ) &&
    !config.getConfig().legacyPrintBareReplWindowOutput
  ) {
    const message =
      '"Please see https://calva.io/output/#about-stdout-in-the-repl-window\nabout why stdout printed to this file is prepended with `;` to be line comments."';
    outputWindow.appendLine(message);
    havePrintedLegacyReplWindowOutputMessage = true;
  }
}

const lastInfoLineData = new Map<string, AppendClojureOptions>([
  ['repl-window', {}],
  ['output-channel', {}],
  ['terminal', {}],
  ['output-view', {}],
]);

function saveLastInfoLineData(destination: string, options: AppendClojureOptions) {
  const { ns, replSessionType, who, shadowBuild, shadowRuntimeId } = options;
  if (ns) {
    lastInfoLineData.set(destination, { ns, replSessionType, who, shadowBuild, shadowRuntimeId });
  }
}

function nsInfoLine(destination: string, options: AppendClojureOptions) {
  const last = lastInfoLineData.get(destination) ?? {};
  const key = `${options.who || ''}:${options.replSessionType}:${options.shadowBuild || ''}:${
    options.shadowRuntimeId ?? ''
  }:${options.ns}`;
  const lastKey = `${last.who || ''}:${last.replSessionType}:${last.shadowBuild || ''}:${
    last.shadowRuntimeId ?? ''
  }:${last.ns}`;
  if (!options.ns || key === lastKey) {
    return '\n';
  }
  const whoBadge =
    options.who && options.who !== 'ui'
      ? themedChalk().evalSeparatorWho(' ' + options.who + ' ')
      : '';
  let sessionTypeStr = options.replSessionType || '';
  if (options.shadowBuild) {
    sessionTypeStr += `:${options.shadowBuild}`;
  }
  if (options.shadowRuntimeId !== undefined) {
    sessionTypeStr += `:${options.shadowRuntimeId}`;
  }
  return `\n;${whoBadge}${themedChalk().evalSeparatorSessionType(
    ' ' + sessionTypeStr + ' '
  )}${themedChalk().evalSeparatorNs(' ' + options.ns + ' ')}\n`;
}

function emitClojureMessage(
  options: Pick<
    AppendClojureOptions,
    'ns' | 'replSessionType' | 'who' | 'shadowBuild' | 'shadowRuntimeId'
  > & {
    outputCategory: OutputCategory;
  },
  message: string,
  didLastTerminateLine: boolean
) {
  try {
    emit({
      category: options.outputCategory,
      text: `${didLastTerminateLine ? '' : '\n'}${message}`,
      who: options.who,
      ns: options.ns,
      replSessionKey: options.replSessionType,
      shadowBuild: options.shadowBuild,
      shadowRuntimeId: options.shadowRuntimeId,
    });
  } catch (e) {
    console.error('Calva output-sink listener error', e.message);
  }
}

function writeClojure(
  options: AppendOptions & AppendClojureOptions,
  message: string,
  didLastTerminateLine: boolean,
  after?: AfterAppendCallback
) {
  const destination = options.destination;
  if (isFilePathDestination(destination)) {
    const printerOptions = { ...printer.prettyPrintingOptions(), 'color?': false };
    const prettyMessage = printer.prettyPrint(message, printerOptions)?.value || message;
    writeToFileDestination(
      destination,
      `${didLastTerminateLine ? '' : '\n'}${prettyMessage}\n`,
      after
    );
    return;
  }
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
  } else if (destination === 'output-view') {
    cljsLib.appendToReplOutputWebview(options, message);
    if (after) {
      after(undefined, undefined);
    }
  }
}

function appendClojure(
  options: AppendOptions & AppendClojureOptions,
  message: string,
  after?: AfterAppendCallback
) {
  const destination = options.destination;
  const didLastTerminateLine = didLastOutputTerminateLine.get(destination) ?? true;
  didLastOutputTerminateLine.set(destination, true);
  if (options.description) {
    appendOtherOut(options.description, {
      who: options.who,
      ns: options.ns,
      replSessionType: options.replSessionType,
    });
  }
  emitClojureMessage(options, message, didLastTerminateLine);
  writeClojure(options, message, didLastTerminateLine, after);
  saveLastInfoLineData(destination, options);
}

export function appendEvaluatedCode(
  code: string,
  options: AppendEvaluatedCodeOptions,
  after?: AfterAppendCallback
) {
  const {
    destination,
    additionalDestinations = [],
    sinkDestination = destination,
    writeVisible = true,
    visibleOutputCategory = 'evalResults',
    ...metadataOptions
  } = options;
  const normalizedDestination = normalizeDestinations(destination);
  const normalizedAdditional = additionalDestinations.flatMap((d) => normalizeDestinations(d));
  const normalizedSink = normalizeDestinations(sinkDestination);
  const sinkFirst = normalizedSink[0];
  const visibleDestinations: string[] = writeVisible
    ? Array.from(new Set([...normalizedDestination, ...normalizedAdditional]))
    : [];
  const didLastTerminateLineByDestination = new Map<string, boolean>();

  for (const visibleDestination of visibleDestinations) {
    didLastTerminateLineByDestination.set(
      visibleDestination,
      didLastOutputTerminateLine.get(visibleDestination) ?? true
    );
    didLastOutputTerminateLine.set(visibleDestination, true);
  }

  const sinkDidLastTerminateLine = sinkFirst
    ? didLastTerminateLineByDestination.get(sinkFirst) ??
      didLastOutputTerminateLine.get(sinkFirst) ??
      true
    : true;

  if (sinkFirst && !didLastTerminateLineByDestination.has(sinkFirst)) {
    didLastOutputTerminateLine.set(sinkFirst, true);
  }

  evaluatedCode.routeEvaluatedCode({
    code,
    didLastTerminateLine: sinkDidLastTerminateLine,
    who: metadataOptions.who,
    ns: metadataOptions.ns,
    replSessionKey: metadataOptions.replSessionType,
    shadowBuild: metadataOptions.shadowBuild,
    shadowRuntimeId: metadataOptions.shadowRuntimeId,
    visibleOutputCategory,
    emit: (message) => {
      try {
        emit(message);
      } catch (e) {
        console.error('Calva output-sink listener error', e.message);
      }
    },
    writeVisible: ({ code: visibleCode, didLastTerminateLine, outputCategory }) => {
      if (!visibleDestinations.length) {
        if (after) {
          after(undefined, undefined);
        }
        return;
      }
      visibleDestinations.forEach((visibleDestination, index) => {
        writeClojure(
          {
            destination: visibleDestination,
            outputCategory,
            ...metadataOptions,
          },
          visibleCode,
          didLastTerminateLineByDestination.get(visibleDestination) ?? didLastTerminateLine,
          index === visibleDestinations.length - 1 ? after : undefined
        );
      });
    },
  });

  visibleDestinations.forEach((visibleDestination) => {
    saveLastInfoLineData(visibleDestination, metadataOptions);
  });
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
  const destinations = normalizeDestinations(getDestinationConfiguration().evalResults);
  if (!destinations.length) {
    if (after) {
      after(undefined, undefined);
    }
    return;
  }
  if (options.description) {
    appendOtherOut(options.description, {
      who: options.who,
      ns: options.ns,
      replSessionType: options.replSessionType,
      shadowBuild: options.shadowBuild,
      shadowRuntimeId: options.shadowRuntimeId,
    });
  }
  destinations.forEach((destination, index) => {
    const didLastTerminateLine = didLastOutputTerminateLine.get(destination) ?? true;
    didLastOutputTerminateLine.set(destination, true);
    if (index === 0) {
      emitClojureMessage({ ...options, outputCategory: 'evalResults' }, code, didLastTerminateLine);
    }
    const isLast = index === destinations.length - 1;
    writeClojure(
      { destination, outputCategory: 'evalResults', ...options },
      code,
      didLastTerminateLine,
      isLast ? after : undefined
    );
    saveLastInfoLineData(destination, options);
  });
}

/**
 * Appends evaluation related Clojure code.
 * Prepending with newline if last output did not end with a newline.
 * Fencing in a `clojure` markdown block if destination is `output-channel`.
 * @param code The code to append
 * @param after Optional callback to run after the append
 */
export function appendClojureOther(message: string, after?: AfterAppendCallback) {
  const destinations = normalizeDestinations(getDestinationConfiguration().otherOutput);
  if (!destinations.length) {
    if (after) {
      after(undefined, undefined);
    }
    return;
  }
  destinations.forEach((destination, index) => {
    const didLastTerminateLine = didLastOutputTerminateLine.get(destination) ?? true;
    didLastOutputTerminateLine.set(destination, true);
    if (index === 0) {
      emitClojureMessage({ outputCategory: 'clojure' }, message, didLastTerminateLine);
    }
    const isLast = index === destinations.length - 1;
    writeClojure(
      { destination, outputCategory: 'clojure' },
      message,
      didLastTerminateLine,
      isLast ? after : undefined
    );
    saveLastInfoLineData(destination, {});
  });
}

function writeAppend(options: AppendOptions, message: string, after?: AfterAppendCallback) {
  const destination = options.destination;
  const didLastTerminateLine = didLastOutputTerminateLine.get(destination) ?? true;
  didLastOutputTerminateLine.set(destination, util.stripAnsi(message).endsWith('\n'));
  if (isFilePathDestination(destination)) {
    writeToFileDestination(destination, message, after);
    return;
  }
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
  if (destination === 'output-view') {
    cljsLib.appendToReplOutputWebview(options, message);
  }
}

function append(options: AppendOptions, message: string, after?: AfterAppendCallback) {
  try {
    emit({
      category: options.outputCategory,
      text: util.stripAnsi(message),
      who: options.who,
      ns: options.ns,
      replSessionKey: options.replSessionKey,
      shadowBuild: options.shadowBuild,
      shadowRuntimeId: options.shadowRuntimeId,
    });
  } catch (e) {
    console.error('Calva output-sink listener error', e.message);
  }
  writeAppend(options, message, after);
}

/**
 * Appends output without adding a newline at the end.
 * Use for stdout messages related to an evaluation
 * @param message The message to append
 * @param after Optional callback to run after the append
 */
export function appendEvalOut(
  message: string,
  options: AppendClojureOptions = {},
  after?: AfterAppendCallback
) {
  const destinations = normalizeDestinations(getDestinationConfiguration().evalOutput);
  if (!destinations.length) {
    if (after) {
      after(undefined, undefined);
    }
    return;
  }
  try {
    emit({
      category: 'evalOut',
      text: util.stripAnsi(message),
      who: options.who,
      ns: options.ns,
      replSessionKey: options.replSessionType,
      shadowBuild: options.shadowBuild,
      shadowRuntimeId: options.shadowRuntimeId,
    });
  } catch (e) {
    console.error('Calva output-sink listener error', e.message);
  }
  destinations.forEach((destination, index) => {
    const coloredMessage =
      destinationSupportsAnsi(destination) && !messageContainsAnsi(message)
        ? themedChalk().evalOut(message)
        : message;
    const isLast = index === destinations.length - 1;
    writeAppend(
      {
        destination,
        outputCategory: 'evalOut',
        who: options.who,
        ns: options.ns,
        replSessionKey: options.replSessionType,
        shadowBuild: options.shadowBuild,
        shadowRuntimeId: options.shadowRuntimeId,
      },
      coloredMessage,
      isLast ? after : undefined
    );
  });
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
  const destinations = normalizeDestinations(getDestinationConfiguration().evalOutput);
  if (!destinations.length) {
    if (after) {
      after(undefined, undefined);
    }
    return;
  }
  // Emit nsInfoLine and message once each (using first destination for representative info line)
  const firstInfoLine = nsInfoLine(destinations[0], options);
  try {
    emit({
      category: 'evalErr',
      text: util.stripAnsi(firstInfoLine),
      who: options.who,
      ns: options.ns,
      replSessionKey: options.replSessionType,
      shadowBuild: options.shadowBuild,
      shadowRuntimeId: options.shadowRuntimeId,
    });
  } catch (e) {
    console.error('Calva output-sink listener error', e.message);
  }
  try {
    emit({
      category: 'evalErr',
      text: util.stripAnsi(message),
      who: options.who,
      ns: options.ns,
      replSessionKey: options.replSessionType,
      shadowBuild: options.shadowBuild,
      shadowRuntimeId: options.shadowRuntimeId,
    });
  } catch (e) {
    console.error('Calva output-sink listener error', e.message);
  }
  destinations.forEach((destination, index) => {
    const coloredMessage =
      destinationSupportsAnsi(destination) && !messageContainsAnsi(message)
        ? themedChalk().evalErr(message)
        : message;
    const evalErrOptions: AppendOptions = {
      destination,
      outputCategory: 'evalErr',
      who: options.who,
      ns: options.ns,
      replSessionKey: options.replSessionType,
      shadowBuild: options.shadowBuild,
      shadowRuntimeId: options.shadowRuntimeId,
    };
    writeAppend(evalErrOptions, nsInfoLine(destination, options));
    const isLast = index === destinations.length - 1;
    writeAppend(evalErrOptions, coloredMessage, isLast ? after : undefined);
    saveLastInfoLineData(destination, options);
  });
}

/**
 * Appends output without adding a newline at the end.
 * Use for stdout and other messages not related to an evaluation
 * (e.g. out of band messages)
 * @param message The message to append
 * @param after Optional callback to run after the append
 */
export function appendOtherOut(
  message: string,
  options: AppendClojureOptions = {},
  after?: AfterAppendCallback
) {
  const destinations = normalizeDestinations(getDestinationConfiguration().otherOutput);
  if (!destinations.length) {
    if (after) {
      after(undefined, undefined);
    }
    return;
  }
  try {
    emit({
      category: 'otherOut',
      text: util.stripAnsi(message),
      who: options.who ?? 'ui',
      ns: options.ns,
      replSessionKey: options.replSessionType,
      shadowBuild: options.shadowBuild,
      shadowRuntimeId: options.shadowRuntimeId,
    });
  } catch (e) {
    console.error('Calva output-sink listener error', e.message);
  }
  destinations.forEach((destination, index) => {
    const coloredMessage =
      destinationSupportsAnsi(destination) && !messageContainsAnsi(message)
        ? themedChalk().otherOut(message)
        : message;
    const isLast = index === destinations.length - 1;
    writeAppend(
      {
        destination,
        outputCategory: 'otherOut',
        who: options.who ?? 'ui',
        ns: options.ns,
        replSessionKey: options.replSessionType,
        shadowBuild: options.shadowBuild,
        shadowRuntimeId: options.shadowRuntimeId,
      },
      coloredMessage,
      isLast ? after : undefined
    );
  });
}

/**
 * Appends error output without adding a newline at the end.
 * Use for stderr and other error messages not related to an evaluation
 * (e.g. out of band messages)
 * @param message The message to append
 * @param after Optional callback to run after the append
 */
export function appendOtherErr(
  message: string,
  options: AppendClojureOptions = {},
  after?: AfterAppendCallback
) {
  const destinations = normalizeDestinations(getDestinationConfiguration().otherOutput);
  if (!destinations.length) {
    if (after) {
      after(undefined, undefined);
    }
    return;
  }
  try {
    emit({
      category: 'otherErr',
      text: util.stripAnsi(message),
      who: options.who ?? 'ui',
      ns: options.ns,
      replSessionKey: options.replSessionType,
      shadowBuild: options.shadowBuild,
      shadowRuntimeId: options.shadowRuntimeId,
    });
  } catch (e) {
    console.error('Calva output-sink listener error', e.message);
  }
  destinations.forEach((destination, index) => {
    const coloredMessage =
      destinationSupportsAnsi(destination) && !messageContainsAnsi(message)
        ? themedChalk().otherErr(message)
        : message;
    const isLast = index === destinations.length - 1;
    writeAppend(
      {
        destination,
        outputCategory: 'otherErr',
        who: options.who ?? 'ui',
        ns: options.ns,
        replSessionKey: options.replSessionType,
        shadowBuild: options.shadowBuild,
        shadowRuntimeId: options.shadowRuntimeId,
      },
      coloredMessage,
      isLast ? after : undefined
    );
  });
}

function writeAppendLine(options: AppendOptions, message: string, after?: AfterAppendCallback) {
  const destination = options.destination;
  const didLastTerminateLine = didLastOutputTerminateLine.get(destination) ?? true;
  didLastOutputTerminateLine.set(destination, true);
  if (isFilePathDestination(destination)) {
    writeToFileDestination(destination, message + '\n', after);
    return;
  }
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
    writeAppend(options, message + '\r\n', after);
    return;
  }
  if (destination === 'output-view') {
    cljsLib.appendToReplOutputWebview(options, '\n\n' + message);
  }
}

function appendLine(options: AppendOptions, message: string, after?: AfterAppendCallback) {
  try {
    emit({
      category: options.outputCategory,
      text: util.stripAnsi(message),
      who: options.who,
      ns: options.ns,
      replSessionKey: options.replSessionKey,
    });
  } catch (e) {
    console.error('Calva output-sink listener error', e.message);
  }
  writeAppendLine(options, message, after);
}

/**
 * Appends output adding a newline at the end.
 * Use for stdout messages related to an evaluation
 * (Maybe there is no use case for this even, as all eval output already should have any newlines needed)
 * @param message The message to append
 * @param after Optional callback to run after the append
 */
export function appendLineEvalOut(
  message: string,
  options: AppendClojureOptions = {},
  after?: AfterAppendCallback
) {
  const destinations = normalizeDestinations(getDestinationConfiguration().evalOutput);
  if (!destinations.length) {
    if (after) {
      after(undefined, undefined);
    }
    return;
  }
  try {
    emit({
      category: 'evalOut',
      text: util.stripAnsi(message),
      who: options.who,
      ns: options.ns,
      replSessionKey: options.replSessionType,
      shadowBuild: options.shadowBuild,
      shadowRuntimeId: options.shadowRuntimeId,
    });
  } catch (e) {
    console.error('Calva output-sink listener error', e.message);
  }
  destinations.forEach((destination, index) => {
    const coloredMessage =
      destinationSupportsAnsi(destination) && !messageContainsAnsi(message)
        ? themedChalk().evalOut(message)
        : message;
    const isLast = index === destinations.length - 1;
    writeAppendLine(
      {
        destination,
        outputCategory: 'evalOut',
        who: options.who,
        ns: options.ns,
        replSessionKey: options.replSessionType,
        shadowBuild: options.shadowBuild,
        shadowRuntimeId: options.shadowRuntimeId,
      },
      coloredMessage,
      isLast ? after : undefined
    );
  });
}

/**
 * Appends output adding a newline at the end.
 * Use for stderr messages related to an evaluation
 * (Maybe there is no use case for this even, as all eval output already should have any newlines needed)
 * @param message The message to append
 * @param after Optional callback to run after the append
 */
export function appendLineEvalErr(
  message: string,
  options: AppendClojureOptions = {},
  after?: AfterAppendCallback
) {
  const destinations = normalizeDestinations(getDestinationConfiguration().evalOutput);
  if (!destinations.length) {
    if (after) {
      after(undefined, undefined);
    }
    return;
  }
  try {
    emit({
      category: 'evalErr',
      text: util.stripAnsi(message),
      who: options.who,
      ns: options.ns,
      replSessionKey: options.replSessionType,
      shadowBuild: options.shadowBuild,
      shadowRuntimeId: options.shadowRuntimeId,
    });
  } catch (e) {
    console.error('Calva output-sink listener error', e.message);
  }
  destinations.forEach((destination, index) => {
    const coloredMessage =
      destinationSupportsAnsi(destination) && !messageContainsAnsi(message)
        ? themedChalk().evalErr(message)
        : message;
    const isLast = index === destinations.length - 1;
    writeAppendLine(
      {
        destination,
        outputCategory: 'evalErr',
        who: options.who,
        ns: options.ns,
        replSessionKey: options.replSessionType,
        shadowBuild: options.shadowBuild,
        shadowRuntimeId: options.shadowRuntimeId,
      },
      coloredMessage,
      isLast ? after : undefined
    );
  });
}

/**
 * Appends output adding a newline at the end.
 * Use for stdout and other messages not related to an evaluation
 * (e.g. out of band messages)
 * @param message The message to append
 * @param after Optional callback to run after the append
 */
export function appendLineOtherOut(
  message: string,
  options: AppendClojureOptions = {},
  after?: AfterAppendCallback
) {
  const destinations = normalizeDestinations(getDestinationConfiguration().otherOutput);
  if (!destinations.length) {
    if (after) {
      after(undefined, undefined);
    }
    return;
  }
  try {
    emit({
      category: 'otherOut',
      text: util.stripAnsi(message),
      who: options.who ?? 'ui',
      ns: options.ns,
      replSessionKey: options.replSessionType,
      shadowBuild: options.shadowBuild,
      shadowRuntimeId: options.shadowRuntimeId,
    });
  } catch (e) {
    console.error('Calva output-sink listener error', e.message);
  }
  destinations.forEach((destination, index) => {
    const coloredMessage =
      destinationSupportsAnsi(destination) && !messageContainsAnsi(message)
        ? themedChalk().otherOut(message)
        : message;
    const isLast = index === destinations.length - 1;
    writeAppendLine(
      {
        destination,
        outputCategory: 'otherOut',
        who: options.who ?? 'ui',
        ns: options.ns,
        replSessionKey: options.replSessionType,
        shadowBuild: options.shadowBuild,
        shadowRuntimeId: options.shadowRuntimeId,
      },
      coloredMessage,
      isLast ? after : undefined
    );
  });
}

/**
 * Appends output adding a newline at the end.
 * Use for stderr and other error messages not related to an evaluation
 * (e.g. out of band messages)
 * @param message The message to append
 * @param after Optional callback to run after the append
 */
export function appendLineOtherErr(
  message: string,
  options: AppendClojureOptions = {},
  after?: AfterAppendCallback
) {
  const destinations = normalizeDestinations(getDestinationConfiguration().otherOutput);
  if (!destinations.length) {
    if (after) {
      after(undefined, undefined);
    }
    return;
  }
  try {
    emit({
      category: 'otherErr',
      text: util.stripAnsi(message),
      who: options.who ?? 'ui',
      ns: options.ns,
      replSessionKey: options.replSessionType,
      shadowBuild: options.shadowBuild,
      shadowRuntimeId: options.shadowRuntimeId,
    });
  } catch (e) {
    console.error('Calva output-sink listener error', e.message);
  }
  destinations.forEach((destination, index) => {
    const coloredMessage =
      destinationSupportsAnsi(destination) && !messageContainsAnsi(message)
        ? themedChalk().otherErr(message)
        : message;
    const isLast = index === destinations.length - 1;
    writeAppendLine(
      {
        destination,
        outputCategory: 'otherErr',
        who: options.who ?? 'ui',
        ns: options.ns,
        replSessionKey: options.replSessionType,
        shadowBuild: options.shadowBuild,
        shadowRuntimeId: options.shadowRuntimeId,
      },
      coloredMessage,
      isLast ? after : undefined
    );
  });
}

/**
 * Appends a prompt to the repl window.
 * Needs to be called via here, because we keep track of whether the last output ended with a newline or not.
 */
export async function replWindowAppendPrompt() {
  didLastOutputTerminateLine.set('repl-window', true);
  await outputWindow.appendPrompt();
}

/**
 * Forces a prompt to be appended to the repl window, bypassing the duplicate check.
 * Needs to be called via here, because we keep track of whether the last output ended with a newline or not.
 */
export async function replWindowForceAppendPrompt() {
  didLastOutputTerminateLine.set('repl-window', true);
  await outputWindow.forceAppendPrompt();
}

function formatStacktrace(stacktrace: any[]) {
  return stacktrace
    .filter((entry) => {
      return (
        !entry.flags.includes('dup') &&
        !['clojure.lang.RestFn', 'clojure.lang.AFn'].includes(entry.class)
      );
    })
    .map((entry) => {
      const name = entry.var || entry.name;
      return `${name} (${entry.file}:${entry.line})`;
    })
    .join('\n');
}

function printStackTrace(stacktrace: any[]) {
  const destinations = normalizeDestinations(getDestinationConfiguration().evalResults);
  for (const destination of destinations) {
    if (isFilePathDestination(destination)) {
      writeToFileDestination(destination, '\n' + formatStacktrace(stacktrace) + '\n');
      continue;
    }
    switch (destination) {
      case 'repl-window':
        outputWindow.printLastStacktrace();
        void replWindowAppendPrompt();
        break;
      case 'output-view':
        cljsLib.appendStackTraceToReplOutputWebview(stacktrace);
        break;
      case 'output-channel':
        outputChannel.appendLine('');
        outputChannel.appendLine(formatStacktrace(stacktrace));
        break;
      case 'terminal':
        getOutputPTY().write('\n' + formatStacktrace(stacktrace) + '\n');
        break;
      default:
        console.error(
          'Printing the last stacktrace is not supported for the configured results output destination:',
          destination
        );
        break;
    }
  }
}

export function printLastStacktrace() {
  const session = replSession.getSession();
  session
    .stacktrace()
    .then((stacktrace) => {
      if (stacktrace.stacktrace) {
        printStackTrace(stacktrace.stacktrace);
      }
    })
    .catch((e) => {
      console.error(`Failed fetching stacktrace: ${e.message}`);
    });
}
