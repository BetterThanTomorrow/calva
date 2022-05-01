import { NReplSession } from '.';
import { cljsLib, tryToGetDocument, getFileType } from '../utilities';
import * as outputWindow from '../results-output/results-doc';
import { isUndefined } from 'lodash';
import { assertIsDefined } from '../type-checks';

function tryToGetSession(fileType?: string): NReplSession | undefined {
  const doc = tryToGetDocument({});

  if (isUndefined(fileType)) {
    fileType = getFileType(doc);
  }
  if (fileType.match(/^clj[sc]?/)) {
    return cljsLib.getStateValue(fileType);
  } else {
    if (outputWindow.isResultsDoc(doc)) {
      return outputWindow.getSession();
    } else {
      return cljsLib.getStateValue('cljc');
    }
  }
}

function getSession(fileType?: string): NReplSession {
  const session = tryToGetSession(fileType);

  assertIsDefined(session, 'Expected to be able to get an nrepl session!');

  return session;
}

function getReplSessionType(connected: boolean): string | undefined {
  const doc = tryToGetDocument({});
  const fileType = getFileType(doc);
  let sessionType: string | undefined = undefined;

  if (connected) {
    if (outputWindow.isResultsDoc(doc)) {
      sessionType = outputWindow.getSessionType();
    } else if (fileType == 'cljs' && tryToGetSession('cljs') !== undefined) {
      sessionType = 'cljs';
    } else if (fileType == 'clj' && tryToGetSession('clj') !== undefined) {
      sessionType = 'clj';
    } else if (tryToGetSession('cljc') !== undefined) {
      sessionType = tryToGetSession('cljc') == tryToGetSession('clj') ? 'clj' : 'cljs';
    } else {
      sessionType = 'clj';
    }
  }

  return sessionType;
}

function updateReplSessionType() {
  const connected = cljsLib.getStateValue('connected');
  const replSessionType = getReplSessionType(connected);
  cljsLib.setStateValue('current-session-type', replSessionType);
}

function getReplSessionTypeFromState(): string | undefined {
  return cljsLib.getStateValue('current-session-type');
}

export {
  tryToGetSession,
  getSession,
  getReplSessionType,
  updateReplSessionType,
  getReplSessionTypeFromState,
};
