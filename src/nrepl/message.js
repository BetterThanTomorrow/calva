'use strict';
var operation = {
    "EVALUATE" : "eval",
    "LIST_SESSIONS" :  "lsSessions"
}

function evalMsg(params) {
    return {
        "op" : operation.EVALUATE,
        "code" : params.code,
        "session" : params.session
    };
};

function listSessions() {
    return {
        "op" : operation.LIST_SESSIONS
    };
};

module.exports = {
    "eval" : evalMsg,
    "listSessions" : listSessions
};
