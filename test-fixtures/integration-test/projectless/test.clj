(ns test)


(comment
  ;; Let's try it without instrumentation first. This
  ;; function has a bug. Evaluate it the usual way
  ;; (`Alt+Enter`) first and then call it.

  (defn bar
    [n]
    (cond (> n 40) (+ n 20)
          (> n 20) (- (first n) 20)
          :else 0))

  (bar 2)  ; works
  (bar 24) ; throws, what's going on?

  ;; That's a strange error message (maybe you say,
  ;; depending on how familiar you are with Clojure).
  ;; Now instrument the function as described above.
  ;; Calva will indicate code that is instrumented for
  ;; debugging. Now evaluate the problematic function
  ;; call. The debugger will start and wait for you
  ;; to step through the function.
  ;;
  ;; To un-instrument the function, just evaluate it
  ;; the normal way (top level evaluation).
  ;; Debugger docs here: https://calva.io/debugger/

  ;; NB: If you are new to Clojure you might find some
  ;; familiarity noting that Calva has a debugger.
  ;; However, try exploring Interactive Programming,
  ;; using the REPL first. That's the Clojure Way.
  ;; This section is here for you to get aware that
  ;; the debugger exists, for those rare occasions
  ;; when it is actually needed.
  :rcf)