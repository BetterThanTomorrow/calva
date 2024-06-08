import * as vscode from 'vscode';
import * as util from './utilities';
import * as state from './state';
import { NReplSession } from './nrepl';
import * as replSession from './nrepl/repl-session';
import * as output from './results-output/output';

function report(res) {
  if (res.status == 'ok') {
    output.appendLineEvalOut('Reloaded: (' + res.reloaded.join(' ') + ')');
    output.appendLineEvalOut(':ok');
  } else {
    if (res.status == 'error') {
      output.appendLineEvalOut('Error reloading: ' + res.errorNs);
      //chan.appendLine(res.error); // TODO: Moar error reporting
    }
    if (res.err != undefined) {
      output.appendLineEvalOut(res.err);
    }
    output.appendLineEvalOut(':error 😿');
  }
  return res;
}

export function refresh(opts?: Record<string, unknown>) {
  const doc = util.tryToGetDocument({}),
    client: NReplSession = replSession.getSession(util.getFileType(doc));

  if (client != undefined) {
    output.appendLineEvalOut('Reloading...');
    return client.refresh(opts).then((res) => {
      return report(res);
    });
  } else {
    return vscode.window.showErrorMessage('Not connected to a REPL.');
  }
}

export function refreshAll(opts?: Record<string, unknown>) {
  const doc = util.tryToGetDocument({}),
    client: NReplSession = replSession.getSession(util.getFileType(doc));

  if (client != undefined) {
    output.appendLineEvalOut('Reloading all the things...');
    return client.refreshAll(opts).then((res) => {
      return report(res);
    });
  } else {
    return vscode.window.showErrorMessage('Not connected to a REPL.');
  }
}
