'use strict';

import * as net from 'net';
import {Buffer} from 'buffer';
import * as Bencoder from 'bencoder';

function connect(state, hostname, port) {
     if (state.connection === null) {
        state.connection = net.createConnection({host: hostname,
                                                 port: port});
     }
     return state;
};

function send(connection, msg, callback) {
    var nREPLResponse = new Buffer('');
    
    var encodedMsg = Bencoder.encode(msg);
    connection.write(encodedMsg);
    connection.on('data', function (data) {
        try {
            nREPLResponse = Buffer.concat([nREPLResponse, data]);
            var response = Bencoder.decode(nREPLResponse);
            callback(response);
        } catch (error) {
            // waiting for the rest of the response
        }
    });
};

module.exports = {
    connect : connect,
    send : send
};
