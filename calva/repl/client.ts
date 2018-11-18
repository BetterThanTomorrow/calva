import * as state from '../state';
import * as calvaLib from '../../lib/calva';


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
    getDefaultOptions
};
