import * as vscode from 'vscode';
import { getStateValue, setStateValue, removeStateValue } from '../../out/cljs-lib/cljs-lib';
import * as nodeUtil from 'util';

const NREPL_MESSAGES_CHANNEL_KEY = 'nReplMessagesChannel';
const NREPL_MESSAGES_CHANNEL_NAME = 'nREPL Messages';

function getMessageChannel(): vscode.OutputChannel {
  return getStateValue(NREPL_MESSAGES_CHANNEL_KEY);
}

function createMessageChannel(): void {
  const channel = vscode.window.createOutputChannel(NREPL_MESSAGES_CHANNEL_NAME);
  setStateValue(NREPL_MESSAGES_CHANNEL_KEY, channel);
  channel.show();
}

function deleteMessageChannel(channel: vscode.OutputChannel): void {
  channel.hide();
  channel.dispose();
  removeStateValue(NREPL_MESSAGES_CHANNEL_KEY);
}

function toggleEnabled(): void {
  const channel = getMessageChannel();
  if (channel) {
    deleteMessageChannel(channel);
  } else {
    createMessageChannel();
  }
}

function formatNreplMessage(message: any): string {
  return nodeUtil.inspect(message, false, 2, false);
}

function loggingEnabled(): boolean {
  return getMessageChannel() ? true : false;
}

function log(message: any, direction: Direction): void {
  if (loggingEnabled()) {
    const channel = getMessageChannel();
    if (channel) {
      const formattedMessage = `${direction}\n${formatNreplMessage(message)}\n`;
      channel.appendLine(formattedMessage);
    }
  }
}

const enum Direction {
  ClientToServer = '-> sent',
  ClientToServerNotSupported = '->| not sent! (not supported by the server)',
  ServerToClient = '<- received',
}

export { toggleEnabled, log, Direction, loggingEnabled };
