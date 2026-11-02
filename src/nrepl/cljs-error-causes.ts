import type { StacktraceCause } from './cider';

// The value shadow-cljs gives an evaluation that throws. The runtime keeps the exception in *e,
// and cider-nrepl has no causes for it.
export const EXCEPTION_VALUE = ':repl/exception!';

const MARKER = 'calva-cljs-error-causes ';

// Prints the causes of *e, outermost first, as JSON after `MARKER`, following ex-info causes and JS
// Error causes. The ex-data is printed with 50 items per collection and 10 levels at most, so data
// that is infinite or deep can't hang the runtime, and data that can't be printed is left out. The
// REPL moves *1 to *2 and *2 to *3, and makes the value *1, so setting *2 and *1 back, and
// evaluating to *1, leaves them as they were. It doesn't throw, which would change *e.
export const causesCode = `(let [o1 *1 o2 *2 o3 *3
      printed (try
                (binding [*print-length* 50 *print-level* 10]
                  (js/JSON.stringify
                   (clj->js (->> *e
                                 (iterate #(or (ex-cause %) (when (instance? js/Error %) (.-cause %))))
                                 (take-while some?)
                                 (take 20)
                                 (map (fn [e]
                                        {:class (if (instance? ExceptionInfo e) "cljs.core/ExceptionInfo" (str (.-name e)))
                                         :message (ex-message e)
                                         :data (try (some-> (ex-data e) pr-str) (catch :default _ nil))}))))))
                (catch :default _ "[]"))]
  (set! *2 o3)
  (set! *1 o2)
  (println (str "${MARKER}" printed))
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
