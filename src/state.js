const SESSION_TYPE = require('./nrepl/session_type');

module.exports = {
    hostname : null,
    port: null,
    session : null,
    session_type: SESSION_TYPE.NONE,
    connected: false,
    last_communication: null
}
