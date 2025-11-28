import { clojureDocsCiderNReplLookup } from '../clojuredocs';
import * as replSession from '../nrepl/repl-session';
import * as sessionRegistry from '../nrepl/session-registry';
import * as clientRegistry from '../nrepl/client-registry';

// TODO: Only nRepl lookups for now. Figure out how to enable clojure-lsp.

export const getClojureDocsDotOrg = async (symbol: string, ns = 'user') => {
  const activeClientKey = clientRegistry.getActiveClientKey();
  const session = activeClientKey
    ? sessionRegistry.getPrimarySessionForClient(activeClientKey)
    : null;
  if (!session) {
    return { error: "Can't retrieve REPL session for session key. Is the REPL connected?" };
  }
  const clojureDocs = await clojureDocsCiderNReplLookup(session, symbol, ns);
  return clojureDocs;
};

export const getSymbolInfo = async (symbol: string, sessionKey: string, ns = 'user') => {
  const client = replSession.getSession(sessionKey);
  if (!client || !client.supports('info')) {
    return { error: "Can't retrieve REPL session for session key. Is the REPL connected?" };
  }
  const res = await client.info(ns, symbol);
  return res;
};
