(ns calva.repl.input.history
  "What the REPL Inputs evaluated, oldest first: adding to it, the entries the REPL Inputs walk, the
   quick pick that searches them, and the entries the way `workspaceState` keeps them."
  (:require
   [clojure.string :as string]))

(def per-session-setting
  "The setting that keeps the history to the session the REPL Input evaluates in."
  "calva.outputViews.replInputHistoryPerSession")

(def ^:private context-keys
  [:repl-input.context/ns :repl-input.context/ns-form :repl-input.context/session-key])

(defn entry
  "Returns the history entry of `code`, evaluated in `context`."
  [code context]
  (merge {:repl-input.history/code (string/trim code)}
         (select-keys context context-keys)))

(defn add
  "Returns `entries` with `new-entry` last, unless its code is blank, or the last entry has the same code
   and context."
  [entries {:repl-input.history/keys [code] :as new-entry}]
  (if (or (string/blank? code) (= (peek entries) new-entry))
    entries
    (conj (vec entries) new-entry)))

(defn visible
  "Returns the `entries` evaluated in the session `session-key` when `per-session?`, else all of them."
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
  (mapv (fn [{:repl-input.history/keys [code] :repl-input.context/keys [ns ns-form session-key]}]
          {:code code :ns ns :nsForm ns-form :sessionKey session-key})
        entries))

(defn from-stored
  "Returns the entries that `workspaceState` kept as `stored`, skipping what isn't an entry."
  [stored]
  (into []
        (comp (filter (comp string? :code))
              (map (fn [{:keys [code ns nsForm sessionKey]}]
                     {:repl-input.history/code code
                      :repl-input.context/ns ns
                      :repl-input.context/ns-form nsForm
                      :repl-input.context/session-key sessionKey})))
        stored))
