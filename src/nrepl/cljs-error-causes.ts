import type { NReplEvaluation } from '.';
import type { StacktraceCause } from './cider';

// The value shadow-cljs gives an evaluation that throws. The runtime keeps the exception in *e,
// and cider-nrepl has no causes for it.
export const EXCEPTION_VALUE = ':repl/exception!';

const MARKER = 'calva-cljs-error-causes ';

// Prints the causes of *e, outermost first, as JSON after `MARKER`, following ex-info causes and JS
// Error causes. The ex-data is printed with 50 items per collection and 10 levels at most, so data
// that is infinite or deep can't hang the runtime, and data that can't be printed is left out. The
// REPL moves *1 to *2 and *2 to *3, and makes the value *1, so setting *2 and *1 back, and
// evaluating to *1, leaves them as they were. It doesn't throw, which would change *e. It is
// evaluated in the namespace of the error, so it names cljs.core's vars in full.
export const causesCode = `(cljs.core/let [o1 cljs.core/*1 o2 cljs.core/*2 o3 cljs.core/*3
      printed (try
                (cljs.core/binding [cljs.core/*print-length* 50 cljs.core/*print-level* 10]
                  (js/JSON.stringify
                   (cljs.core/clj->js
                    (cljs.core/->> cljs.core/*e
                                   (cljs.core/iterate (cljs.core/fn [e]
                                                        (cljs.core/or (cljs.core/ex-cause e)
                                                                      (cljs.core/when (cljs.core/instance? js/Error e) (.-cause e)))))
                                   (cljs.core/take-while cljs.core/some?)
                                   (cljs.core/take 20)
                                   (cljs.core/map (cljs.core/fn [e]
                                                    {:class (if (cljs.core/instance? cljs.core/ExceptionInfo e)
                                                              "cljs.core/ExceptionInfo"
                                                              (cljs.core/str (.-name e)))
                                                     :message (cljs.core/ex-message e)
                                                     :data (try (cljs.core/some-> (cljs.core/ex-data e) cljs.core/pr-str)
                                                                (catch :default _ nil))}))))))
                (catch :default _ "[]"))]
  (set! cljs.core/*2 o3)
  (set! cljs.core/*1 o2)
  (cljs.core/println (cljs.core/str "${MARKER}" printed))
  o1)`;

type PrintedCause = { class: string; message: string | null; data: string | null };

// The causes that `causesCode` printed in `stdout`, without frames, or undefined when it printed none
export function parseCauses(stdout: string): StacktraceCause[] | undefined {
  const line = stdout.split('\n').find((l) => l.startsWith(MARKER));
  if (line === undefined) {
    return undefined;
  }
  try {
    const printed: PrintedCause[] = JSON.parse(line.slice(MARKER.length));
    const causes = printed.map(
      ({ class: className, message, data }): StacktraceCause => ({
        class: className,
        message: message ?? [],
        phase: [],
        stacktrace: [],
        ...(data === null ? {} : { data }),
      })
    );
    return causes.length > 0 ? causes : undefined;
  } catch {
    return undefined;
  }
}

// The causes of the error of `evaluation`, which evaluated to `value`. For a ClojureScript evaluation that
// evaluated to `EXCEPTION_VALUE`, they are read from *e with `causesCode`, in the evaluation's namespace or
// `ns`, and a failed request gives no causes. shadow-cljs doesn't always run a session's evaluations in
// the order they are sent, so the next ones wait for the causes.
export function errorCauses(evaluation: NReplEvaluation, value: string, ns: string) {
  const session = evaluation.session;
  if (session.replType !== 'cljs' || value !== EXCEPTION_VALUE) {
    return evaluation.causes;
  }
  let stdout = '';
  const probe = session.eval(causesCode, evaluation.ns ?? ns, {
    stdout: (m) => (stdout += m),
    pprintOptions: { enabled: false },
  });
  return session.holdEvaluationsUntil(
    probe.value.then(
      () => parseCauses(stdout),
      () => undefined
    )
  );
}
