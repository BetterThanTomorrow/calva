import statusbar from './statusbar';
import * as state from './state';
import { updateReplSessionType } from './nrepl/repl-session';
import { setCljsTypeContext } from './when-contexts';

function update() {
  updateReplSessionType();
  statusbar.update();
  setCljsTypeContext();
}

export default {
  update,
};
