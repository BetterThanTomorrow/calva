import * as state from '../state';


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
