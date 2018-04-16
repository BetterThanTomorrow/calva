'use strict';
const util = require('../utilities');

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
    REFRESH_CLEAR: "refresh-clear",
    FORMAT_CODE: "format-code",
    TEST: "test",
    TEST_ALL: "test-all",
    RETEST: "retest",
    PPRINT: "pprint"
}

function startCljsReplMsg(session) {
    return {
        op: operation.EVALUATE,
        code: util.getCljsReplStartCode(),
        session: session
    };
}

function startShadowCljsReplMsg(session, build) {
    return {
        op: operation.EVALUATE,
        code: util.getShadowCljsReplStartCode(build),
        session: session
    };
}

function checkSessionTypeMsg(session) {
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

function evaluateMsg(session, ns, code, pprint = false) {
    let msg = {
        op: operation.EVALUATE,
        ns: ns,
        code: code,
        session: session,
    };
    if (pprint) {
        msg.pprint = 1;
    }
    return msg;
};

function formatMsg(session, code) {
    return {
        op: operation.PPRINT,
        code: code,
        session: session
    };
}

function loadFileMsg(session, fileContent, fileName, filePath) {
    return {
        op: operation.LOAD_FILE,
        file: fileContent,
        "file-name": fileName,
        "file-path": filePath,
        session: session
    };
};

function completeMsg(session, namespace, symbol) {
    return {
        op: operation.COMPLETE,
        symbol: symbol,
        ns: namespace,
        session: session
    };
};

function infoMsg(session, namespace, symbol) {
    return {
        op: operation.INFO,
        symbol: symbol,
        ns: namespace,
        session: session
    };
};

function stacktraceMsg(session) {
    return {
        op: operation.STACKTRACE,
        session: session
    };
};

function cloneMsg(session) {
    let msg = {
        op: operation.CLONE,
    };
    if (session) {
        msg.session = session;
    }
    return msg;
};

function closeMsg(session) {
    return {
        op: operation.CLOSE,
        session: session
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

function testMsg(session, ns) {
    return {
        op: operation.TEST,
        ns: ns,
        session: session
    };
};

function testAllMsg(session) {
    return {
        op: operation.TEST_ALL,
        session: session,
        'load?': 1
    };
};

function rerunTestsMsg(session) {
    return {
        op: operation.RETEST,
        session: session
    };
};


module.exports = {
    evaluate: evaluateMsg,
    listSessions: listSessionsMsg,
    checkSessionType: checkSessionTypeMsg,
    loadFile: loadFileMsg,
    complete: completeMsg,
    info: infoMsg,
    stacktrace: stacktraceMsg,
    clone: cloneMsg,
    close: closeMsg,
    refresh: refreshMsg,
    refreshAll: refreshAllMsg,
    refreshClear: refreshClearMsg,
    test: testMsg,
    testAll: testAllMsg,
    rerunTestsMsg,
    format: formatMsg,
    operation: operation,
    startCljsReplMsg,
    startShadowCljsReplMsg
};
