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
 *
 * The cljs session has no runtime in its REPL state, so shadow-cljs runs each of its evals in the
 * build's default runtime at that moment, and sends that eval every print from the runtime while
 * it runs.
 */
type RuntimeSession = { buildId: string; session: Promise<nrepl.NReplSession> };

/** A runtime of a shadow-cljs build, on the connection of `clientKey`. */
export type RuntimeTarget = { clientKey: string; buildId: string; runtimeId: number };

type ConnectionRuntime = Pick<RuntimeTarget, 'clientKey' | 'runtimeId'>;

/** A shadow-remote message, carrying a print from runtime `from` when `op` is `runtime-print`. */
type RuntimePrint = { op: string; from?: number; stream?: string; text?: string };

type RuntimeEvaluation = Pick<nrepl.NReplEvaluation, 'out' | 'err' | 'value' | 'finished'>;

const runtimeSessions = new Map<string, RuntimeSession>();
const runningEvaluations = new Map<string, RuntimeEvaluation[]>();

const runtimeKey = ({ clientKey, runtimeId }: ConnectionRuntime) => `${clientKey}/${runtimeId}`;

// `node-repl` and `browser-repl` build ids come without the colon
const buildKeyword = (buildId: string) => `:${buildId.replace(/^:/, '')}`;

async function selectRuntime(session: nrepl.NReplSession, buildId: string, runtimeId: number) {
  const selected = await session.eval(
    `(shadow.cljs.devtools.api/repl ${buildKeyword(buildId)} {:runtime-id ${runtimeId}})`,
    'user'
  ).value;
  if (!selected?.startsWith('[:selected')) {
    throw new Error(`Could not connect a session to shadow-cljs runtime ${runtimeId}: ${selected}`);
  }
}

async function createSessionForRuntime({
  clientKey,
  buildId,
  runtimeId,
}: RuntimeTarget): Promise<nrepl.NReplSession> {
  const cljSession = sessionRegistry.getPrimarySessionForClient(clientKey);
  if (!cljSession) {
    throw new Error(`No Clojure session for connection ${clientKey}`);
  }
  const session = await cljSession.clone();
  session.replType = 'cljs';
  try {
    await selectRuntime(session, buildId, runtimeId);
    // shadow-cljs sends evals in the node-repl process's stdout already
    if (buildKeyword(buildId) !== ':node-repl') {
      await cljSession.shadowCljsRemoteMessage(`{:op :runtime-print-sub :to ${runtimeId}}`);
    }
    return session;
  } catch (e) {
    session.close();
    throw e;
  }
}

/**
 * Returns the session that evaluates in the `target` runtime, creating it on first use.
 */
function getSessionForRuntime(target: RuntimeTarget): Promise<nrepl.NReplSession> {
  const key = runtimeKey(target);
  if (runtimeSessions.has(key)) {
    return runtimeSessions.get(key).session;
  }
  const session = createSessionForRuntime(target);
  runtimeSessions.set(key, { buildId: target.buildId, session });
  session.then(
    (s) => s.addOnCloseHandler(() => runtimeSessions.delete(key)),
    () => runtimeSessions.delete(key)
  );
  return session;
}

/**
 * True when shadow-cljs would run an eval in the cljs session in the `target` runtime, which it
 * decides from the build's default runtime, not from Calva's selection.
 */
function isCljsSessionRuntime(
  { clientKey, buildId, runtimeId }: RuntimeTarget,
  defaultRuntimeId: number | undefined
): boolean {
  const cljsBuild = clientRegistry.getConnectionState(clientKey)?.cljsBuild;
  return (
    !!cljsBuild &&
    buildKeyword(cljsBuild) === buildKeyword(buildId) &&
    runtimeId === defaultRuntimeId
  );
}

/**
 * Returns the session to evaluate in the `target` runtime. That is `cljsSession` when
 * `defaultRuntimeId`, the default runtime of the target's build, is the target, since shadow-cljs
 * runs the cljs session's evals there anyway. Evals in the runtime then share one queue and each
 * gets its own prints from shadow-cljs. Otherwise it is the session for the runtime.
 */
export function getEvalSessionForRuntime(
  target: RuntimeTarget,
  defaultRuntimeId: number | undefined,
  cljsSession: nrepl.NReplSession
): Promise<nrepl.NReplSession> {
  if (isCljsSessionRuntime(target, defaultRuntimeId)) {
    return Promise.resolve(cljsSession);
  }
  return getSessionForRuntime(target);
}

export function closeSessionForRuntime(clientKey: string, runtimeId: number): void {
  void runtimeSessions.get(runtimeKey({ clientKey, runtimeId }))?.session.then(
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
  const key = runtimeKey({ clientKey, runtimeId });
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

function appendToOutputView(runtime: ConnectionRuntime, { stream, text }: RuntimePrint) {
  const options: output.AppendClojureOptions = {
    replSessionType: sessionRegistry.getSecondarySessionKeyForClient(runtime.clientKey),
    shadowBuild: runtimeSessions.get(runtimeKey(runtime))?.buildId,
    shadowRuntimeId: runtime.runtimeId,
  };
  if (stream === 'stderr') {
    output.appendOtherErr(text, options);
  } else {
    output.appendOtherOut(text, options);
  }
}

function cljsSessionGetsPrint({ clientKey, runtimeId }: ConnectionRuntime): boolean {
  const cljsSession = sessionRegistry.getSession(
    sessionRegistry.getSecondarySessionKeyForClient(clientKey)
  );
  return (
    runtimeId === clientRegistry.getConnectionState(clientKey)?.shadowCljsRuntimeId &&
    !!cljsSession?.hasRunningEvaluations()
  );
}

/**
 * Routes a `:runtime-print` shadow-remote message, and ignores other messages. A print goes to the
 * oldest unfinished tracked evaluation in its runtime, which is the one running, since a session
 * evaluates one message at a time. A finished evaluation stays tracked until its value settles, so
 * a print read together with its reply would otherwise land there. Without such an evaluation, it
 * goes to the Output view, except a print from the connection's selected runtime while the cljs
 * session evaluates, since shadow-cljs sends that eval the print. The prints and the eval's value
 * reach Calva on separate paths, so a print can arrive after the value, and then goes to the next
 * evaluation queued in the runtime, or to the Output view.
 */
export function handleRuntimePrint(clientKey: string, print: RuntimePrint): void {
  if (print.op !== 'runtime-print') {
    return;
  }
  const runtime = { clientKey, runtimeId: print.from };
  const evaluation = runningEvaluations.get(runtimeKey(runtime))?.find((e) => !e.finished);
  if (evaluation) {
    if (print.stream === 'stderr') {
      evaluation.err(print.text);
    } else {
      evaluation.out(print.text);
    }
  } else if (!cljsSessionGetsPrint(runtime)) {
    appendToOutputView(runtime, print);
  }
}

sessionEvents.onSessionsChanged(({ type, clientKey, runtime }) => {
  if (type === 'runtime-disconnected' && clientKey && runtime) {
    closeSessionForRuntime(clientKey, runtime.runtimeId);
  }
});
