import * as vscode from 'vscode';
import { getConfig } from '../config';
import { getStateValue, setStateValue } from '../../out/cljs-lib/cljs-lib';
import * as nodeUtil from 'util';

const NREPL_MESSAGES_CHANNEL_KEY = 'nReplMessagesChannel';
const NREPL_MESSAGES_CHANNEL_NAME = 'nREPL Messages';

function init(): void {
    if (getConfig().logNreplMessages === true) {
        const channel = vscode.window.createOutputChannel(NREPL_MESSAGES_CHANNEL_NAME);
        setStateValue(NREPL_MESSAGES_CHANNEL_KEY, channel);
    }
}

function formatNreplMessage(message: any): string {
    return nodeUtil.inspect(message, false, 2, false);
}

function log(message: string): void {
    const nreplMessagesChannel: vscode.OutputChannel = getStateValue(NREPL_MESSAGES_CHANNEL_KEY);
    if (nreplMessagesChannel) {
        nreplMessagesChannel.appendLine(formatNreplMessage(message));
    }
}