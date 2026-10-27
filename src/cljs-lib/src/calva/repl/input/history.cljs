(ns calva.repl.input.history
  "What the REPL Inputs evaluated, oldest first: adding to it, the entries the REPL Inputs walk, the
   quick pick that searches them, and the entries the way `workspaceState` keeps them."
  (:require
   [calva.repl.input.context :as context]
   [clojure.string :as string]))

(def per-session-setting
  "The setting that keeps the history to the session the REPL Input evaluates in."
  "calva.outputViews.replInputHistoryPerSession")

(defn entry
  "Returns the history entry of `code`, evaluated in `context`, with the context's source file."
  [code {:repl-input.context/keys [ns ns-form session-key source-file]}]
  {:repl-input.history/code (string/trim code)
   :repl-input.context/ns ns
   :repl-input.context/ns-form ns-form
   :repl-input.context/session-key session-key
   :repl-input.context/source-file source-file})

(defn- same-entry?
  "True when `entry` and `other` have the same code, namespace and source file, and, when `entry` has no
   source file, the same session key."
  [entry other]
  (let [identity-keys (cond-> [:repl-input.history/code
                               :repl-input.context/ns
                               :repl-input.context/source-file]
                        (not (:repl-input.context/source-file entry)) (conj :repl-input.context/session-key))]
    (= (select-keys entry identity-keys) (select-keys other identity-keys))))

(defn add
  "Returns `entries` with `new-entry` last, unless its code is blank, or the last entry is the same entry."
  [entries {:repl-input.history/keys [code] :as new-entry}]
  (if (or (string/blank? code) (same-entry? new-entry (peek entries)))
    entries
    (conj (vec entries) new-entry)))

(defn visible
  "Returns the `entries` in the session `session-key` when `per-session?`, else all of them."
  [entries session-key per-session?]
  (if per-session?
    (filterv #(= session-key (:repl-input.context/session-key %)) entries)
    (vec entries)))

(defn pick-items
  "Returns the quick pick items for `entries`, newest first: the code as the label, with what VS Code would
   show as an icon escaped, the namespace as the description, and the entry's `index` in `entries`."
  [entries]
  (->> entries
       (map-indexed (fn [index {:repl-input.history/keys [code] :repl-input.context/keys [ns]}]
                      {:label (-> code
                                  (string/replace #"\s+" " ")
                                  (string/replace "$(" "\\$("))
                       :description ns
                       :index index}))
       reverse
       vec))

(defn stored
  "Returns `entries` the way `workspaceState` keeps them."
  [entries]
  (mapv (fn [{:repl-input.history/keys [code] :repl-input.context/keys [ns ns-form session-key source-file]}]
          {:code code :ns ns :nsForm ns-form :sessionKey session-key :sourceFile source-file})
        entries))

(defn from-stored
  "Returns the entries that `workspaceState` kept as `stored`, skipping what isn't an entry."
  [stored]
  (into []
        (comp (filter (comp string? :code))
              (map (fn [{:keys [code ns nsForm sessionKey sourceFile]}]
                     {:repl-input.history/code code
                      :repl-input.context/ns ns
                      :repl-input.context/ns-form nsForm
                      :repl-input.context/session-key sessionKey
                      :repl-input.context/source-file sourceFile})))
        stored))

(defn routed
  "Returns `entries` with the session key that `route` gives each now, as
   `calva.repl.input.context/routed-session-key` says, routing each source file once."
  [entries route]
  (let [route-once (memoize route)]
    (mapv #(assoc % :repl-input.context/session-key (context/routed-session-key route-once %)) entries)))
