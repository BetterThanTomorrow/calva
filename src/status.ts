import * as namespace from './namespace';
import statusbar from './statusbar';

function update() {
    namespace.updateREPLSessionType();
    statusbar.update();
}

export default {
    update
};