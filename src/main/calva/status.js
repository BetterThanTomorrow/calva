import util from './utilities';
import statusbar from './statusbar';

function update() {
    util.updateREPLSessionType();
    statusbar.update();
}

export default {
    update
};