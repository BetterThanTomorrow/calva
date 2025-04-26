import { NReplSession } from '.';
import { cljsLib, tryToGetDocument, getFileType } from '../utilities';
import * as outputWindow from '../repl-window/repl-doc';
import { isUndefined } from 'lodash';

/**
 * Determines the appropriate session key based on file type and context
 */
function getSessionKey(fileType?: string): string {
  const doc = tryToGetDocument({});

  if (isUndefined(fileType)) {
    fileType = getFileType(doc);
  }

  // If we're in the REPL window, use its session type
  if (outputWindow.isResultsDoc(doc)) {
    return outputWindow.getSessionType();
  }

  // Return the detected file type if valid
  if (fileType.match(/^clj[sc]?/) && cljsLib.getStateValue(fileType)) {
    return fileType;
  }

  // Default to cljc for all other cases
  return 'cljc';
}

function getSession(fileType?: string): NReplSession {
  const sessionKey = getSessionKey(fileType);

  if (
    sessionKey === outputWindow.getSessionType() &&
    outputWindow.isResultsDoc(tryToGetDocument({}))
  ) {
    return outputWindow.getSession();
  } else {
    return cljsLib.getStateValue(sessionKey);
  }
}

function getReplSessionType(connected: boolean): string | undefined {
  const doc = tryToGetDocument({});
  const fileType = getFileType(doc);
  let sessionType: string | undefined = undefined;

  if (connected) {
    if (outputWindow.isResultsDoc(doc)) {
      sessionType = outputWindow.getSessionType();
    } else if (fileType == 'cljs' && getSession('cljs') !== null) {
      sessionType = 'cljs';
    } else if (fileType == 'clj' && getSession('clj') !== null) {
      sessionType = 'clj';
    } else if (getSession('cljc') !== null) {
      sessionType = getSession('cljc') == getSession('clj') ? 'clj' : 'cljs';
    } else {
      sessionType = 'clj';
    }
  }

  return sessionType;
}

function updateReplSessionType() {
  // TODO: Should the session type be set to cljs even when the cljs repl is not yet connected?
  const connected = cljsLib.getStateValue('connected');
  const replSessionType = getReplSessionType(connected);
  cljsLib.setStateValue('current-session-type', replSessionType);
}

function getReplSessionTypeFromState() {
  return cljsLib.getStateValue('current-session-type');
}

export {
  getSession,
  getReplSessionType,
  updateReplSessionType,
  getReplSessionTypeFromState,
  getSessionKey,
};
