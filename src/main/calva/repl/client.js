import * as state from '../state';
import nrepl from 'goog:calva.repl.nrepl';

function send(msg, callback) {
    nrepl.message(this, msg, callback);
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
