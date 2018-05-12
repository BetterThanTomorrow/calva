import { updateREPLSessionType } from './utilities';
import updateStatusBar from './statusbar';

function updateStatus() {
    updateREPLSessionType();
    updateStatusBar();
}

export default updateStatus;