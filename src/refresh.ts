import * as vscode from 'vscode';
import * as util from './utilities';
import * as state from './state';
import { NReplSession } from './nrepl';
import * as replSession from './nrepl/repl-session';
import * as output from './results-output/output';
import * as config from './config';
import * as sessionRegistry from './nrepl/session-registry';
import * as whoTracking from './api/who-tracking';

function report(res) {
  if (res.status == 'ok') {
    output.appendLineEvalOut('Reloaded: (' + res.reloaded.join(' ') + ')', { who: 'ui' });
    output.appendLineEvalOut(':ok', { who: 'ui' });
  } else {
    if (res.status == 'error') {
      output.appendLineEvalOut('Error reloading: ' + res.errorNs, { who: 'ui' });
      //chan.appendLine(res.error); // TODO: Moar error reporting
    }
    if (res.err != undefined) {
      output.appendLineEvalOut(res.err, { who: 'ui' });
    }
    output.appendLineEvalOut(':error 😿', { who: 'ui' });
  }
  return res;
}

function initRefreshOptions(opts: Record<string, unknown>) {
  const configuredBeforeFn = config.getConfig().refreshNssBeforeFn;
  const configuredAfterFn = config.getConfig().refreshNssAfterFn;
  if (!opts['before'] && configuredBeforeFn) {
    opts['before'] = configuredBeforeFn;
  }
  if (!opts['after'] && configuredAfterFn) {
    opts['after'] = configuredAfterFn;
  }
}

export function refresh(opts: Record<string, unknown> = {}) {
  initRefreshOptions(opts);

  const doc = util.tryToGetDocument({}),
    client: NReplSession = replSession.getSession();

  if (client != undefined) {
    const sessionKey = sessionRegistry.resolveSessionKey(client);
    whoTracking.recordEvaluation(sessionKey, 'ui');
    whoTracking.setCurrentWho(client.sessionId, 'ui');
    output.appendLineEvalOut('Reloading...', { who: 'ui' });
    return client.refresh(opts).then((res) => {
      return report(res);
    });
  } else {
    return vscode.window.showErrorMessage('Not connected to a REPL.');
  }
}

export function refreshAll(opts: Record<string, unknown> = {}) {
  initRefreshOptions(opts);

  const doc = util.tryToGetDocument({}),
    client: NReplSession = replSession.getSession();

  if (client != undefined) {
    const sessionKey = sessionRegistry.resolveSessionKey(client);
    whoTracking.recordEvaluation(sessionKey, 'ui');
    whoTracking.setCurrentWho(client.sessionId, 'ui');
    output.appendLineEvalOut('Reloading all the things...', { who: 'ui' });
    return client.refreshAll(opts).then((res) => {
      return report(res);
    });
  } else {
    return vscode.window.showErrorMessage('Not connected to a REPL.');
  }
}
