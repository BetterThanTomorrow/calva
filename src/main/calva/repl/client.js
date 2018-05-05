import state from '../state';
import net from 'net';
import { Buffer } from 'buffer';
import bencoder from 'bencoder';
import migration from 'goog:calva.migration';
import nrepl from 'goog:calva.repl.nrepl';


const CONTINUATION_ERROR_MESSAGE = "Unexpected continuation: \"";

function decode(decodedResult) {
    if (decodedResult.rest.length === 0)
        return decodedResult;
    try {
        const decodedObj = bencoder.decode(decodedResult.rest);
        decodedResult.decodedObjects.push(decodedObj);
        decodedResult.rest = Buffer.from('');
        return decodedResult;
    } catch (error) {
        const errorMessage = error.message;
        if (!!errorMessage && errorMessage.startsWith(CONTINUATION_ERROR_MESSAGE)) {
            const unexpectedContinuation = errorMessage.slice(CONTINUATION_ERROR_MESSAGE.length, errorMessage.length - 1);

            const rest = decodedResult.rest;
            const encodedObj = rest.slice(0, rest.length - unexpectedContinuation.length);

            decodedResult.decodedObjects.push(bencoder.decode(encodedObj));
            decodedResult.rest = Buffer.from(unexpectedContinuation);

            return decode(decodedResult);
        } else {
            return decodedResult;
        }
    }
}

function isDone(chunks) {
    let lastObj = [...chunks].pop();
    return lastObj && lastObj.status && lastObj.status.indexOf('done') !== -1;
}

function send(msg, callback) {
    let buffer = Buffer.from(''),
        encodedMsg = bencoder.encode(migration.jsify(msg));
    let chunks = [];
    this.on('data', (chunk) => {
        try {
            buffer = Buffer.concat([buffer, chunk]);
            let {
                decodedObjects,
                rest
            } = decode({
                decodedObjects: [],
                rest: buffer
            });
            buffer = rest;
            let validDecodedObjects = decodedObjects.reduce((objs, obj) => {
                if (!isDone(objs))
                    objs.push(obj);
                return objs;
            }, []);

            chunks.push(...validDecodedObjects)

            if (isDone(chunks)) {
                callback(chunks);
            }

        } catch (error) {
            console.error(error);
        }
    });
    this.write(encodedMsg, 'binary');
}

function create(options) {
    let current = state.deref(),
        _options = null;
    if (current.get('connected')) {
        _options = {
            host: current.get('hostname'),
            port: current.get('port')
        }
    } else {
        _options = options;
    }

    if (_options !== null) {
        let con = nrepl.connect(_options);
        con.send = send.bind(con);

        return con;
    }
}



export default {
    create
};
