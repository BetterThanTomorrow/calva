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

function refresh(document = {}) {
  const doc = util.tryToGetDocument(document),
    client: NReplSession | undefined = replSession.getSession(util.getFileType(doc)),
    chan: vscode.OutputChannel = state.outputChannel();

  if (client !== undefined) {
    chan.appendLine('Reloading...');
    void client.refresh().then((res) => {
      report(res, chan);
    });
  } else {
    void vscode.window.showErrorMessage('Not connected to a REPL.');
  }
}

function refreshAll(document = {}) {
  const doc = util.tryToGetDocument(document),
    client: NReplSession | undefined = replSession.getSession(util.getFileType(doc)),
    chan: vscode.OutputChannel = state.outputChannel();

  if (client !== undefined) {
    chan.appendLine('Reloading all the things...');
    void client.refreshAll().then((res) => {
      report(res, chan);
    });
  } else {
    void vscode.window.showErrorMessage('Not connected to a REPL.');
  }
}

export default {
  refresh,
  refreshAll,
};
