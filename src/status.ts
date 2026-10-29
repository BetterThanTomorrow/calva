import * as cljsLib from '../out/cljs-lib/cljs-lib';
import * as statusbar from './statusbar';
import * as replSession from './nrepl/repl-session';
import * as whenContexts from './when-contexts';

function update() {
  replSession.updateReplSessionType();
  statusbar.update();
  whenContexts.setCljsTypeContext();
  cljsLib.replInputRoutingChanged();
}

export { update };
