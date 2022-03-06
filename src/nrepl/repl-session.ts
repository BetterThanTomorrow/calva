import { NReplSession } from '.';
import { cljsLib, getDocument, getFileType } from '../utilities';
import * as outputWindow from '../results-output/results-doc';
import { isUndefined } from 'lodash';

function getSession(fileType?: string): NReplSession {
    const doc = getDocument({});

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

function getReplSessionType(connected: boolean): string {
    const doc = getDocument({});
    const fileType = getFileType(doc);
    let sessionType: string = null;

    if (connected) {
        if (outputWindow.isResultsDoc(doc)) {
            sessionType = outputWindow.getSessionType();
        } else if (fileType == 'cljs' && getSession('cljs') !== null) {
            sessionType = 'cljs';
        } else if (fileType == 'clj' && getSession('clj') !== null) {
            sessionType = 'clj';
        } else if (getSession('cljc') !== null) {
            sessionType =
                getSession('cljc') == getSession('clj') ? 'clj' : 'cljs';
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

function getReplSessionTypeFromState() {
    return cljsLib.getStateValue('current-session-type');
}

export {
    getSession,
    getReplSessionType,
    updateReplSessionType,
    getReplSessionTypeFromState,
};
