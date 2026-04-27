import * as sessionRegistry from './session-registry';
import * as replSession from './repl-session';
import status from '../status';
import * as util from '../utilities';
import * as cljsLib from '../../out/cljs-lib/cljs-lib';
import * as teardownCore from './session-teardown-core';
import * as clojureDocs from '../clojuredocs';

function applySideEffects(removed: string[]): void {
  if (removed.length === 0) {
    return;
  }

  // Handle ClojureDocs session cleanup
  removed.forEach((key) => {
    clojureDocs.clearClojureDocsSession(key);
  });

  replSession.updateReplSessionType();
  status.update();
  if (sessionRegistry.listSessions().length === 0) {
    util.setConnectedState(false);
    cljsLib.setStateValue('current-session-type', null);
  }
}

export function teardownSessionsForClient(clientKey: string): string[] {
  const removed = teardownCore.teardownSessionsForClient(clientKey);
  applySideEffects(removed);
  return removed;
}

export function teardownSessionKeys(sessionKeys: string[]): string[] {
  const removed = teardownCore.teardownSessionKeys(sessionKeys);
  applySideEffects(removed);
  return removed;
}
