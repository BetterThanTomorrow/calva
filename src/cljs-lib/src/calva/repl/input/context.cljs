(ns calva.repl.input.context
  "The namespace, `ns` form and session the REPL Inputs evaluate in, which both views share, and the
   context line that shows it.")

(def user-namespace
  {:repl-input.context/ns "user"
   :repl-input.context/ns-form "(in-ns 'user)"})

(defn- with-connection
  "Returns `context`, connected when one of the `session-keys` is its session key."
  [context session-keys]
  (assoc context
         :repl-input.context/connected? (contains? (set session-keys) (:repl-input.context/session-key context))))

(defn current
  "Returns the context with the `lock` when there is one. Else the `editor-namespace` of the last active
   Clojure editor at its cursor, or `user` before any, in the `routed-session-key`. It is connected when
   one of the `session-keys` is its session key, and its `editor-ns` is the namespace that following the
   editor gives."
  [{:keys [lock editor-namespace routed-session-key session-keys]}]
  (let [followed (or editor-namespace user-namespace)
        context (-> (or lock (assoc followed :repl-input.context/session-key routed-session-key))
                    (assoc :repl-input.context/locked? (some? lock)
                           :repl-input.context/editor-ns (:repl-input.context/ns followed)))]
    (with-connection context session-keys)))

(defn evaluation-context
  "Returns `context` with the namespace, `ns` form and session key that `overrides` names, connected
   when one of the `session-keys` is its session key."
  [context overrides session-keys]
  (with-connection (merge context (into {} (remove (comp nil? val)) overrides)) session-keys))

(defn lock-after
  "Returns the lock after code was evaluated in `context`: the namespace of the code's `ns` or `in-ns`
   form, `code-namespace` as `[ns ns-form]`, in the context's session, when the evaluation `succeeded?`.
   Else `lock`."
  [lock context code-namespace succeeded?]
  (if-let [[ns ns-form] (when succeeded? code-namespace)]
    {:repl-input.context/ns ns
     :repl-input.context/ns-form ns-form
     :repl-input.context/session-key (:repl-input.context/session-key context)}
    lock))

(defn line
  "Returns what the context line shows for `context`: its namespace, `ns` form and session, whether it is
   locked and connected, and the editor's namespace."
  [context]
  (select-keys context [:repl-input.context/ns
                        :repl-input.context/ns-form
                        :repl-input.context/session-key
                        :repl-input.context/locked?
                        :repl-input.context/connected?
                        :repl-input.context/editor-ns]))

(defn not-connected-message
  "Returns what evaluating says when no session answers to the session key of `context`."
  [{:repl-input.context/keys [session-key]}]
  (str "Not evaluated: "
       (if session-key
         (str "the REPL session " session-key " isn't connected")
         "the REPL isn't connected")))
