'use strict';
var bencode = require('bencoder'),
    util = require('util'),
    net = require('net'),
    stream = require('stream');

function uuid() { // helper
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
        .replace(/[xy]/g, replacer).toUpperCase();

    function replacer(c) {
        var r = Math.random()*16|0,
            v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    }
};

var messageLogPrinter = function(response, length) {
    var inspected = "";
    if (typeof response === "object") {
        inspected += "{\n" + Object.keys(response).map(function(k) {
            var v = response[k];
            if (typeof v === 'string' && v.length > 100)
                v = v.slice(0,100) + "...";
                // v = '"' + (v.slice(0,100) + "...").replace(/"/g, '\\"') + '"';
            return k + ": " + util.inspect(v, {depth: 0});
        }).join(",\n  ") + "\n}";
    } else inspected = util.inspect(response, {depth: 0});
    return inspected;
};
var nullLogger = {log: function(response, length) {}};
var defaultLogger = {
  log: function(response, length) {
    var printed = messageLogPrinter(response, length);
    console.log("nrepl message received (%s bytes, %s)", length, printed);
  }
};
var currentLogger = nullLogger;

function createMessageStream(verbose, socket) {
    var messageStream = new stream.Transform();
    messageStream._writableState.objectMode = false;
    messageStream._readableState.objectMode = true;
    messageStream._bytesLeft = 0;
    messageStream._messageCache = [];
    messageStream._chunkLeft = new Buffer("");

    messageStream._transform = function(chunk, encoding, callback) {
        verbose && console.log("nREPL message chunk received (%s bytes)", chunk.length);
        this._bytesLeft += chunk.length;
        this._chunkLeft = Buffer.concat([this._chunkLeft, chunk]);
        try {
            while (this._bytesLeft > 0) {
                try {
                    var response = bencode.decode(this._chunkLeft, 'utf8');
                } catch (e) {
                    // bencode.decode fails when the current chunk isn't
                    // complete, in this case we just cache the chunk and wait to
                    // be called again
                    callback(); return;
                }
                var encodedResponseLength = bencode.encode(response, 'utf8').length;
                nreplLog(response, encodedResponseLength);
                this._bytesLeft -= encodedResponseLength;
                this.push(response);
                this._messageCache.push(response);
                this._chunkLeft = this._chunkLeft.slice(encodedResponseLength);
                this._messageCache = consumeNreplMessageStream(this.emit.bind(this), this._messageCache);
            }
        } catch (e) {
            this.emit('error', e);
            console.error('nrepl message receive error: ', e.stack || e);
        }
        callback();
    };

    return socket.pipe(messageStream);
};

function nreplLog(response, length) {
  try {
    currentLogger.log(response, length);
  } catch (e) {
    console.error("error in nrepl message logger: ", e);
  }
};

function consumeNreplMessageStream(emit, messages) {
    var receivers = messages.reduce(function(receivers, msg) {
        var queue = receivers[msg.id] || (receivers[msg.id] = []);
        queue.push(msg);
        return receivers;
    }, {});
    Object.keys(receivers).forEach(function(id) {
        emit("messageSequence", id, receivers[id]);
        emit("messageSequence-" + id, receivers[id]);
    });
    return [];
};

function nreplSend(socket, messageStream, msgSpec, callback) {
    var msg = {id: msgSpec.id || uuid()};
    Object.keys(msgSpec).forEach(function(k) {
        if (msgSpec[k] !== undefined) msg[k] = msgSpec[k]; });
    socket.write(bencode.encode(msg), 'binary');

    var errors = [], messages = [],
        msgHandlerName = 'messageSequence-' + msg.id;
    messageStream.on('error', errHandler);
    messageStream.on(msgHandlerName, msgHandler);
    return msg;

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    function errHandler(err) { errors.push(err); }
    function msgHandler(_messages) {
        var done = _messages.some(function(msg) { return !!msg.status; });
        messages = messages.concat(_messages);
        if (!done) return;
        messageStream.removeListener('error', errHandler);
        messageStream.removeListener(msgHandlerName, errHandler);
        callback && callback(errors.length > 0 ? errors : null, messages);
    }
};

// default nREPL ops, see https://github.com/clojure/tools.nrepl/blob/master/doc/ops.md

function clone(connection, session, callback) {
    if (typeof session === 'function') { callback = session; session = undefined; }
    return connection.send({op: 'clone', session: session}, function(err, messages) {
        var newSess = messages && messages[0] && messages[0]["new-session"];
        if (newSess) connection.sessions.push(newSess);
        callback(err, messages);
    });
};

function close(connection, session, callback) {
    if (typeof session === 'function') { callback = session; session = undefined; }
    return connection.send({op: 'close', session: session}, function(err, messages) {
        var status = messages && messages[0] && messages[0].status;
        var closed = status && status.indexOf("session-closed") > -1;
        if (closed) connection.sessions = connection.sessions.filter(function(ea) { return ea != session; });
        callback(err, messages);
    });
};

function describe(connection, session, verbose, callback) {
    return connection.send({op: 'describe', 'verbose?': verbose ? 'true' : undefined}, callback);
};

function evaluate(connection, code, ns, session, id, evalFunc, callback) {
    if (typeof session === 'function') { callback = session; session = undefined; }
    else if (typeof ns === 'function') { callback = ns; ns = undefined; }
    else if (typeof id === 'function') { callback = id; id = undefined; }
    else if (typeof evalFunc === 'function') { callback = evalFunc; evalFunc = undefined; }
    return connection.send({op: 'eval', code: code, ns: ns || undefined, session: session, id: id, "eval": evalFunc}, callback);
};

function interrupt(connection, session, id, callback) {
    if (typeof session === 'function') { callback = session; session = undefined; }
    else if (typeof id === 'function') { callback = id; id = undefined; }
    return connection.send({op: 'interrupt', "interrupt-id": id, session: session}, callback);
};

function loadFile(connection, fileContent, fileName, filePath, session, id, callback) {
    if (typeof session === 'function') { callback = session; session = undefined; }
    else if (typeof id === 'function') { callback = id; id = undefined; }
    // :file-name Name of source file, e.g. io.clj
    // :file-path Source-path-relative path of the source file, e.g. clojure/java/io.clj
    return connection.send({op: 'load-file', "file": fileContent, "file-name": fileName, "file-path": filePath}, callback);
};

function lsSessions(connection, callback) {
    return connection.send({op: 'ls-sessions'}, function(err, messages) {
        var sessions = messages && messages[0] && messages[0]["sessions"];
        if (sessions) connection.sessions = sessions;
        callback(err, messages);
    });
};

function stdin(connection, stdin, callback) {
    return connection.send({op: 'stdin', stdin: stdin}, callback);
};

function connect(options) {
    var con           = net.connect(options),
        messageStream = createMessageStream(options.verbose, con);
    con.sessions      = [];
    con.messageStream = messageStream;
    con.send          = nreplSend.bind(null, con, messageStream);
    con.clone         = clone.bind(null, con);
    con.close         = close.bind(null, con);
    con.describe      = describe.bind(null, con);
    con.evaluate      = evaluate.bind(null, con);
    con.interrupt     = interrupt.bind(null, con);
    con.loadFile      = loadFile.bind(null, con);
    con.lsSessions    = lsSessions.bind(null, con);
    con.stdin         = stdin.bind(null, con);
    return con;
};

module.exports = {
    connect: connect,
    log: {
      defaultLogger: defaultLogger,
      nullLogger: nullLogger,
      messageLogPrinter: messageLogPrinter,
      get currentLogger() { return currentLogger; },
      set currentLogger(l) { return currentLogger = l; }
    }
};
