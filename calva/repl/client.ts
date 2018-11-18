import * as state from '../state';
import * as calvaLib from '../../lib/calva';


function send(msg, callback) {
    calvaLib.nrepl_message(this, msg, callback);
}

function create(options?) {
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
        let con = calvaLib.nrepl_connect(_options);
        con.send = send.bind(con);

        return con;
    }
}


function getDefaultOptions() {
    let current = state.deref();
    if (current.get('connected')) {
        return {
            host: current.get('hostname'),
            port: current.get('port')
        };
    } else {
        return {};
    }
}


export default {
    create,
    getDefaultOptions
};
