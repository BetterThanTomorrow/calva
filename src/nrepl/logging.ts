import * as vscode from 'vscode';
import { getConfig } from '../config';
import { getStateValue, setStateValue } from '../../out/cljs-lib/cljs-lib';
import * as nodeUtil from 'util';

const NREPL_MESSAGES_CHANNEL_KEY = 'nReplMessagesChannel';
const NREPL_MESSAGES_CHANNEL_NAME = 'nREPL Messages';

if (getConfig().logNreplMessages === true) {
    vscode.window.createOutputChannel(NREPL_MESSAGES_CHANNEL_NAME);
}

function formatNREPLMessage(message: any): string {
    return nodeUtil.inspect(message, false, 2, false);
}

function log(message: string): void {
    const nreplMessagesChannel: vscode.OutputChannel = getStateValue(NREPL_MESSAGES_CHANNEL_KEY);
    if (nreplMessagesChannel) {
        nreplMessagesChannel.appendLine(formatNREPLMessage(message));
    }
}