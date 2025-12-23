import statusbar from './statusbar';
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
