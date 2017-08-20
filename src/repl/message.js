'use strict';
var operation = {
    EVALUATE: "eval",
    LIST_SESSIONS: "ls-sessions",
    LOAD_FILE: "load-file",
    COMPLETE: "complete",
    CLONE: "clone",
    CLOSE: "close",
    STACKTRACE: "stacktrace",
    INFO: "info",
    REFRESH: "refresh",
    REFRESH_ALL: "refresh-all",
    REFRESH_CLEAR: "refresh-clear"
}

function testSessionMsg(session) {
    return {
        op: operation.EVALUATE,
        code: '(js/parseFloat "3.14")',
        session: session
    };
};

function listSessionsMsg() {
    return {
        op: operation.LIST_SESSIONS
    };
};

function evaluateMsg(session, ns, code) {
    return {
        op: operation.EVALUATE,
        ns: ns,
        code: code, //.replace(/"/g, '\\"')
        session: session
    };
};

function loadFileMsg(session, fileContent, fileName, filePath) {
    return {
        op: operation.LOAD_FILE,
        file : fileContent,
        "file-name": fileName,
        "file-path": filePath,
        session : session
    };
};

function completeMsg(session, namespace, symbol) {
    return {
        op: operation.COMPLETE,
        symbol: symbol,
        ns: namespace,
        session : session
    };
};

function infoMsg(session, namespace, symbol) {
    return {
        op: operation.INFO,
        symbol: symbol,
        ns: namespace,
        session : session
    };
};

function stacktraceMsg(session) {
    return {
        op: operation.STACKTRACE,
        session : session
    };
};

function cloneMsg(session) {
    return {
        op: operation.CLONE,
        session : session
    };
};

function closeMsg(session) {
    return {
        op: operation.CLOSE,
        session : session
    };
};

function refreshMsg(session) {
    return {
        op: operation.REFRESH,
        session: session
    };
};

function refreshAllMsg(session) {
    return {
        op: operation.REFRESH_ALL,
        session: session
    };
};

function refreshClearMsg(session) {
    return {
        op: operation.REFRESH_CLEAR,
        session: session
    };
};

module.exports = {
    evaluate: evaluateMsg,
    listSessions: listSessionsMsg,
    testSession: testSessionMsg,
    loadFile: loadFileMsg,
    complete: completeMsg,
    info: infoMsg,
    stacktrace: stacktraceMsg,
    clone: cloneMsg,
    close: closeMsg,
    refresh: refreshMsg,
    refreshAll: refreshAllMsg,
    refreshClear: refreshClearMsg
};
