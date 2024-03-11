import * as outputWindow from './results-doc';
import * as config from '../config';
import * as vscode from 'vscode';

export interface AfterAppendCallback {
  (insertLocation: vscode.Location, newPosition?: vscode.Location): any;
}

let outputChannel: vscode.OutputChannel;
function initOutputChannel() {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('Calva Results', 'markdown');
  }
}

type OutputDestinations = 'output-window' | 'output-channel';

export type OutputDestinationConfiguration = {
  results: OutputDestinations;
  out: OutputDestinations;
};

export const defaultDestinationConfiguration: OutputDestinationConfiguration = {
  results: 'output-channel',
  out: 'output-channel',
};

function getDestinationConfiguration(): OutputDestinationConfiguration {
  return config.getConfig().outputDestinations || defaultDestinationConfiguration;
}

export function appendClojure(message: string, after?: AfterAppendCallback) {
  const destination = getDestinationConfiguration().results;
  if (destination === 'output-window') {
    outputWindow.append(`${message}\n`, after);
    return;
  }
  if (destination === 'output-channel') {
    initOutputChannel();
    outputChannel.append('```clojure\n' + message + '\n```\n');
    return;
  }
}

let didLastOutputTerminateLine = true;

export function appendOut(message: string, after?: AfterAppendCallback) {
  const destination = getDestinationConfiguration().out;
  if (destination === 'output-window') {
    if (!didLastOutputTerminateLine) {
      outputWindow.append('\n');
    }
    outputWindow.append(`${(didLastOutputTerminateLine ? '; ' : '') + message}`, after);
    didLastOutputTerminateLine = message.endsWith('\n');
    return;
  }
  if (destination === 'output-channel') {
    initOutputChannel();
    outputChannel.append(message);
    return;
  }
}

function asClojureLineComments(message: string) {
  return message
    .split('\n')
    .map((line) => `; ${line}`)
    .join('\n');
}

export function appendLineOut(message: string, after?: AfterAppendCallback) {
  const destination = getDestinationConfiguration().out;
  if (destination === 'output-window') {
    didLastOutputTerminateLine = true;
    outputWindow.appendLine(asClojureLineComments(message), after);
    return;
  }
  if (destination === 'output-channel') {
    initOutputChannel();
    outputChannel.appendLine(message);
    return;
  }
}
