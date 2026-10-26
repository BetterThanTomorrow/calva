(ns calva.repl.input.context
  "The namespace, `ns` form and session the REPL Inputs evaluate in, which both views share, and the
   context line that shows it. A lock and a history entry keep the namespace and the source file, the
   Clojure file the REPL Input followed when they were made, and route that file again on each use.")

(def user-namespace
  {:repl-input.context/ns "user"
   :repl-input.context/ns-form "(in-ns 'user)"})

(defn- with-connection
  "Returns `context`, connected when one of the `session-keys` is its session key."
  [context session-keys]
  (assoc context
         :repl-input.context/connected? (contains? (set session-keys) (:repl-input.context/session-key context))))

(defn routed-session-key
  "Returns the session key that `route` gives for the source file of `linked`, a lock or a history entry.
   Without a source file, returns the session key it keeps, or else what `route` gives without a file."
  [route {:repl-input.context/keys [source-file session-key]}]
  (if (or source-file (nil? session-key))
    (route source-file)
    session-key))

(defn current
  "Returns the context with the `lock` when there is one. Else the `editor-namespace` of the last active
   Clojure editor at its cursor, or `user` before any, with the editor's `editor-file` as the source file.
   Its session key is what `route` gives for its source file, as `routed-session-key` says. It is connected
   when one of the `session-keys` is its session key, and its `editor-ns` and `editor-session-key` are
   what following the editor gives."
  [{:keys [lock editor-namespace editor-file route session-keys]}]
  (let [editor-session-key (route editor-file)
        followed (assoc (or editor-namespace user-namespace)
                        :repl-input.context/source-file editor-file
                        :repl-input.context/session-key editor-session-key)
        context (if lock
                  (assoc lock :repl-input.context/session-key (routed-session-key route lock))
                  followed)]
    (with-connection (assoc context
                            :repl-input.context/locked? (some? lock)
                            :repl-input.context/editor-ns (:repl-input.context/ns followed)
                            :repl-input.context/editor-session-key editor-session-key)
                     session-keys)))

(defn evaluation-context
  "Returns `context` with the namespace, `ns` form and session key that `overrides` names, connected
   when one of the `session-keys` is its session key."
  [context overrides session-keys]
  (with-connection (merge context (into {} (remove (comp nil? val)) overrides)) session-keys))

(defn as-lock
  "Returns the lock that keeps the namespace and `ns` form of `linked`, a context or a history entry, and
   its source file, or without one the session key it has."
  [{:repl-input.context/keys [source-file] :as linked}]
  (select-keys linked [:repl-input.context/ns
                       :repl-input.context/ns-form
                       (if source-file :repl-input.context/source-file :repl-input.context/session-key)]))

(defn lock-after
  "Returns the lock after code was evaluated in `context`: the namespace of the code's `ns` or `in-ns`
   form, `code-namespace` as `[ns ns-form]`, with the context's source file, when the evaluation
   `succeeded?`. Without a source file, it keeps the session key of `lock`, if any. Else `lock`."
  [lock context code-namespace succeeded?]
  (if-let [[ns ns-form] (when succeeded? code-namespace)]
    (as-lock (assoc lock
                    :repl-input.context/ns ns
                    :repl-input.context/ns-form ns-form
                    :repl-input.context/source-file (:repl-input.context/source-file context)))
    lock))

(defn line
  "Returns what the context line shows for `context`: its namespace, `ns` form, source file and session,
   whether it is locked and connected, and the editor's namespace and session."
  [context]
  (select-keys context [:repl-input.context/ns
                        :repl-input.context/ns-form
                        :repl-input.context/source-file
                        :repl-input.context/session-key
                        :repl-input.context/locked?
                        :repl-input.context/connected?
                        :repl-input.context/editor-ns
                        :repl-input.context/editor-session-key]))

(defn not-connected-message
  "Returns what evaluating says when no session answers to the session key of `context`."
  [{:repl-input.context/keys [session-key]}]
  (str "Not evaluated: "
       (if session-key
         (str "the REPL session " session-key " isn't connected")
         "the REPL isn't connected")))
