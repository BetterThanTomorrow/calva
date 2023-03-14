import statusbar from './statusbar';
import * as state from './state';
import { updateReplSessionType } from './nrepl/repl-session';

function update(context = state.extensionContext) {
  updateReplSessionType();
  statusbar.update(context);
}

export default {
  update,
};
