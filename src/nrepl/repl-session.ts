import { NReplSession } from '.';
import { tryToGetDocument, getFileType } from '../utilities';
import { get_state_value, set_state_value } from '../../out/cljs-lib/calva.state';
import * as outputWindow from '../results-output/results-doc';
import { isUndefined } from 'lodash';

function getSession(fileType?: string): NReplSession {
  const doc = tryToGetDocument({});

  if (isUndefined(fileType)) {
    fileType = getFileType(doc);
  }
  if (fileType.match(/^clj[sc]?/) && get_state_value(fileType)) {
    return get_state_value(fileType);
  } else {
    if (outputWindow.isResultsDoc(doc)) {
      return outputWindow.getSession();
    } else {
      return get_state_value('cljc');
    }
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
  const connected = get_state_value('connected');
  const replSessionType = getReplSessionType(connected);
  set_state_value('current-session-type', replSessionType);
}

function getReplSessionTypeFromState() {
  return get_state_value('current-session-type');
}

export { getSession, getReplSessionType, updateReplSessionType, getReplSessionTypeFromState };
