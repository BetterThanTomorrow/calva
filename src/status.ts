import statusbar from './statusbar';
import * as state from './state';
import { updateReplSessionType } from './nrepl/repl-session';

function update() {
  updateReplSessionType();
  statusbar.update();
}

export default {
  update,
};
