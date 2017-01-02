var session_type = {
    CLJS : "ClojureScript Session",
    CLJ : "Clojure Session",
    NONE : "No Session"
}

module.exports = {
    hostname : null,
    port: null,
    session_id : null,
    session_type: session_type.NONE,
    connected: false,
    connection: null,
    last_communication: null
}
