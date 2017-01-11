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
    REFRESH: "refresh"
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

function evaluateMsg(state, ns, code) {
    return {
        op: operation.EVALUATE,
        ns: ns,
        code: code,
        session: state.session
    };
};

function loadFileMsg(state, fileContent, fileName, filePath) {
    return {
        op: operation.LOAD_FILE,
        file : fileContent,
        "file-name": fileName,
        "file-path": filePath,
        session : state.session
    };
};

function completeMsg(state, namespace, symbol) {
    return {
        op: operation.COMPLETE,
        symbol: symbol,
        ns: namespace,
        session : state.session
    };
};

function infoMsg(state, namespace, symbol) {
    return {
        op: operation.INFO,
        symbol: symbol,
        ns: namespace,
        session : state.session
    };
};

function stacktraceMsg(state) {
    return {
        op: operation.STACKTRACE,
        session : state.session
    };
};

function cloneMsg(state) {
    return {
        op: operation.CLONE,
        session : state.session
    };
};

function closeMsg(state) {
    return {
        op: operation.CLOSE,
        session : state.session
    };
};

function refreshMsg(state) {
    return {
        op: operation.REFRESH,
        session: state.session
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
    refresh: refreshMsg
};
