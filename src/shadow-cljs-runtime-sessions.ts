import type * as nrepl from './nrepl';
import * as sessionRegistry from './nrepl/session-registry';
import * as clientRegistry from './nrepl/client-registry';
import * as sessionEvents from './nrepl/session-events';
import * as output from './results-output/output';

/**
 * shadow-cljs picks the runtime for an nREPL eval from the session's REPL state, set by
 * `(shadow.cljs.devtools.api/repl build {:runtime-id n})`, and ignores any runtime option on the
 * eval message. A session set up that way evaluates in that runtime only, so an eval aimed at a
 * specific runtime goes through a session for that runtime. One session per connection and
 * runtime, closed when the runtime disconnects.
 *
 * shadow-cljs sends an eval the runtime's printed output only when it picked the runtime itself,
 * so these evals get none. Calva subscribes to the runtime's prints on its own shadow-remote
 * connection instead, and `handleRuntimePrint` routes them.
 */
type RuntimeSession = { buildId: string; session: Promise<nrepl.NReplSession> };

type RuntimeEvaluation = Pick<nrepl.NReplEvaluation, 'out' | 'err' | 'value' | 'finished'>;

const runtimeSessions = new Map<string, RuntimeSession>();
const runningEvaluations = new Map<string, RuntimeEvaluation[]>();

const runtimeKey = (clientKey: string, runtimeId: number) => `${clientKey}/${runtimeId}`;

async function createSessionForRuntime(
  clientKey: string,
  buildId: string,
  runtimeId: number
): Promise<nrepl.NReplSession> {
  const cljSession = sessionRegistry.getPrimarySessionForClient(clientKey);
  if (!cljSession) {
    throw new Error(`No Clojure session for connection ${clientKey}`);
  }
  const session = await cljSession.clone();
  session.replType = 'cljs';
  // `node-repl` and `browser-repl` build ids come without the colon
  const buildKeyword = `:${buildId.replace(/^:/, '')}`;
  try {
    const selected = await session.eval(
      `(shadow.cljs.devtools.api/repl ${buildKeyword} {:runtime-id ${runtimeId}})`,
      'user'
    ).value;
    if (!selected?.startsWith('[:selected')) {
      throw new Error(
        `Could not connect a session to shadow-cljs runtime ${runtimeId}: ${selected}`
      );
    }
    await cljSession.shadowCljsRemoteMessage(`{:op :runtime-print-sub :to ${runtimeId}}`);
    return session;
  } catch (e) {
    session.close();
    throw e;
  }
}

/**
 * Returns the session that evaluates in `runtimeId` of `buildId` on the `clientKey` connection,
 * creating it on first use.
 */
export function getSessionForRuntime(
  clientKey: string,
  buildId: string,
  runtimeId: number
): Promise<nrepl.NReplSession> {
  const key = runtimeKey(clientKey, runtimeId);
  if (runtimeSessions.has(key)) {
    return runtimeSessions.get(key).session;
  }
  const session = createSessionForRuntime(clientKey, buildId, runtimeId);
  runtimeSessions.set(key, { buildId, session });
  session.then(
    (s) => s.addOnCloseHandler(() => runtimeSessions.delete(key)),
    () => runtimeSessions.delete(key)
  );
  return session;
}

export function closeSessionForRuntime(clientKey: string, runtimeId: number): void {
  void runtimeSessions.get(runtimeKey(clientKey, runtimeId))?.session.then(
    (session) => session.close(),
    () => undefined
  );
}

/**
 * Sends the prints from `runtimeId` to `evaluation` until it is done.
 */
export function trackEvaluation(
  clientKey: string,
  runtimeId: number,
  evaluation: RuntimeEvaluation
): void {
  const key = runtimeKey(clientKey, runtimeId);
  runningEvaluations.set(key, [...(runningEvaluations.get(key) ?? []), evaluation]);
  const untrack = () => {
    const remaining = runningEvaluations.get(key)?.filter((e) => e !== evaluation) ?? [];
    if (remaining.length) {
      runningEvaluations.set(key, remaining);
    } else {
      runningEvaluations.delete(key);
    }
  };
  evaluation.value.then(untrack, untrack);
}

function appendToOutputView(clientKey: string, runtimeId: number, stream: string, text: string) {
  const options: output.AppendClojureOptions = {
    replSessionType: sessionRegistry.getSecondarySessionKeyForClient(clientKey),
    shadowBuild: runtimeSessions.get(runtimeKey(clientKey, runtimeId))?.buildId,
    shadowRuntimeId: runtimeId,
  };
  if (stream === 'stderr') {
    output.appendOtherErr(text, options);
  } else {
    output.appendOtherOut(text, options);
  }
}

/**
 * Routes a `:runtime-print` shadow-remote message, and ignores other messages. A print goes to the
 * oldest unfinished tracked evaluation in its runtime, which is the one running, since a session
 * evaluates one message at a time. A finished evaluation stays tracked until its value settles, so
 * a print read together with its reply would otherwise land there. Without such an evaluation, it
 * goes to the Output view. Prints from the connection's selected runtime reach its evaluations
 * through the eval itself, so outside a tracked evaluation they are skipped. The prints and the eval's value reach Calva on separate paths, so a print can
 * arrive after the value, and then goes to the Output view.
 */
export function handleRuntimePrint(
  clientKey: string,
  { op, from, stream, text }: { op: string; from?: number; stream?: string; text?: string }
): void {
  if (op !== 'runtime-print') {
    return;
  }
  const evaluation = runningEvaluations.get(runtimeKey(clientKey, from))?.find((e) => !e.finished);
  if (evaluation) {
    if (stream === 'stderr') {
      evaluation.err(text);
    } else {
      evaluation.out(text);
    }
  } else if (from !== clientRegistry.getConnectionState(clientKey)?.shadowCljsRuntimeId) {
    appendToOutputView(clientKey, from, stream, text);
  }
}

sessionEvents.onSessionsChanged(({ type, clientKey, runtime }) => {
  if (type === 'runtime-disconnected' && clientKey && runtime) {
    closeSessionForRuntime(clientKey, runtime.runtimeId);
  }
});
