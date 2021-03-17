import { NReplSession } from ".";
import { getDocument, getFileType } from "../utilities";
import * as outputWindow from '../results-output/results-doc';
import { get_state_value, set_state_value } from '../../out/cljs-lib/calva.state';

function getSession(fileType = undefined): NReplSession {
    let doc = getDocument({});

    if (fileType === undefined) {
        fileType = getFileType(doc);
    }
    if (fileType.match(/^clj[sc]?/)) {
        return get_state_value(fileType);
    } else {
        if (outputWindow.isResultsDoc(doc)) {
            return outputWindow.getSession();
        } else {
            return get_state_value('cljc');
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
        }
        else if (fileType == 'cljs' && getSession('cljs') !== null) {
            sessionType = 'cljs'
        }
        else if (fileType == 'clj' && getSession('clj') !== null) {
            sessionType = 'clj'
        }
        else if (getSession('cljc') !== null) {
            sessionType = getSession('cljc') == getSession('clj') ? 'clj' : 'cljs';
        }
        else {
            sessionType = 'clj'
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

export {
    getSession,
    getReplSessionType,
    updateReplSessionType,
    getReplSessionTypeFromState
}