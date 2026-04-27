import statusbar from './statusbar';
import * as replSession from './nrepl/repl-session';
import * as whenContexts from './when-contexts';

function update() {
  replSession.updateReplSessionType();
  statusbar.update();
  whenContexts.setCljsTypeContext();
}

export default {
  update,
};
