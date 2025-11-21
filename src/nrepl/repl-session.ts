import { NReplSession } from '.';
import { cljsLib, tryToGetDocument, getFileType } from '../utilities';
import * as outputWindow from '../repl-window/repl-doc';
import { isUndefined } from 'lodash';
import * as sessionRegistry from './session-registry';

/**
 * Determines the appropriate session key based on file type and context
 */
function getSessionKey(fileType?: string): string | undefined {
  if (!isUndefined(fileType) && sessionRegistry.getSession(fileType)) {
    return fileType;
  }

  const doc = tryToGetDocument({});
  const inferredType = getFileType(doc);

  if (outputWindow.isResultsDoc(doc)) {
    const resultsDocType = outputWindow.getSessionType();
    if (resultsDocType && sessionRegistry.getSession(resultsDocType)) {
      return resultsDocType;
    }
  }

  if (inferredType && sessionRegistry.getSession(inferredType)) {
    return inferredType;
  }

  const storedType = cljsLib.getStateValue('current-session-type');
  if (storedType && sessionRegistry.getSession(storedType)) {
    return storedType;
  }

  const sessions = sessionRegistry.listSessions();
  return sessions[0]?.key;
}

function getSession(fileType?: string): NReplSession {
  const sessionKey = getSessionKey(fileType);

  // Try getting from registry first
  if (sessionKey) {
    const session = sessionRegistry.getSession(sessionKey);
    if (session) {
      return session;
    }
  }

  if (outputWindow.isResultsDoc(tryToGetDocument({}))) {
    return outputWindow.getSession();
  }

  return null;
}

function getReplSessionType(connected: boolean): string | undefined {
  const doc = tryToGetDocument({});
  const fileType = getFileType(doc);
  let sessionType: string | undefined = undefined;

  if (connected) {
    if (outputWindow.isResultsDoc(doc)) {
      sessionType = outputWindow.getSessionType();
    } else if (fileType && sessionRegistry.getSession(fileType)) {
      sessionType = fileType;
    } else {
      const storedType = cljsLib.getStateValue('current-session-type');
      if (storedType && sessionRegistry.getSession(storedType)) {
        sessionType = storedType;
      } else {
        const defaultSession = sessionRegistry.listSessions()[0];
        sessionType = defaultSession?.key;
      }
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
