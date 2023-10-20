import * as vscode from 'vscode';
import * as nodeUtil from 'util';

let NREPL_LOGGING_ENABLED = false;
const NREPL_MESSAGES_CHANNEL_NAME = 'nREPL Messages';
let NREPL_MESSAGE_CHANNEL = null;

function getMessageChannel(): vscode.OutputChannel {
  return NREPL_MESSAGE_CHANNEL;
}

function createMessageChannel(): void {
  NREPL_MESSAGE_CHANNEL = vscode.window.createOutputChannel(NREPL_MESSAGES_CHANNEL_NAME);
  NREPL_MESSAGE_CHANNEL.show(true);
}

export function toggleEnabled(): void {
  NREPL_LOGGING_ENABLED = !NREPL_LOGGING_ENABLED;
  const channel = getMessageChannel();
  if (NREPL_LOGGING_ENABLED && !channel) {
    createMessageChannel();
  }
}

function formatNreplMessage(message: any): string {
  return nodeUtil.inspect(message, false, 2, false);
}

const lastSeenTimes = {};
export function log(message: any, direction: Direction): void {
  if (NREPL_LOGGING_ENABLED) {
    const channel = getMessageChannel();
    if (channel) {
      const lastSeenKey = `${message.session}:${message.id}`;
      const currentTime = Date.now();
      const lastSeenTime = lastSeenTimes[lastSeenKey];
      const timeSinceLastSeen = lastSeenTime ? `${currentTime - lastSeenTime}ms` : '';
      lastSeenTimes[lastSeenKey] = currentTime;
      const formattedMessage = `${Date.now()} ${direction} ${timeSinceLastSeen}\n${formatNreplMessage(
        message
      )}\n`;
      channel.appendLine(formattedMessage);
    }
  }
}

export const enum Direction {
  ClientToServer = '-> sent',
  ClientToServerNotSupported = '->| not sent! (not supported by the server)',
  ServerToClient = '<- received',
}
