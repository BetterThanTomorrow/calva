import * as vscode from 'vscode';
import * as util from './utilities';
import * as state from './state';
import { NReplSession } from './nrepl';
import * as replSession from './nrepl/repl-session';

function report(res, chan: vscode.OutputChannel) {
    if (res.status == 'ok') {
        chan.appendLine('Reloaded: (' + res.reloaded.join(' ') + ')');
        chan.appendLine(':ok');
    } else {
        if (res.status == 'error') {
            chan.appendLine('Error reloading: ' + res.errorNs);
            //chan.appendLine(res.error); // TODO: Moar error reporting
        }
        if (res.err != undefined) {
            chan.appendLine(res.err);
        }
        chan.appendLine(':error 😿');
    }
}

async function refresh(document = {}) {
    let doc = util.getDocument(document),
        client: NReplSession = replSession.getSession(util.getFileType(doc)),
        chan: vscode.OutputChannel = state.outputChannel();

    if (client != undefined) {
        chan.appendLine('Reloading...');
        client.refresh().then((res) => {
            report(res, chan);
        });
    } else {
        vscode.window.showErrorMessage('Not connected to a REPL.');
    }
}

async function refreshAll(document = {}) {
    let doc = util.getDocument(document),
        client: NReplSession = replSession.getSession(util.getFileType(doc)),
        chan: vscode.OutputChannel = state.outputChannel();

    if (client != undefined) {
        chan.appendLine('Reloading all the things...');
        client.refreshAll().then((res) => {
            report(res, chan);
        });
    } else {
        vscode.window.showErrorMessage('Not connected to a REPL.');
    }
}

export default {
    refresh,
    refreshAll,
};
