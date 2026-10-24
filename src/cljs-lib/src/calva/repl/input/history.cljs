(ns calva.repl.input.history
  "What the REPL Inputs evaluated, oldest first: adding to it, walking it with `up` and `down`, recalling
   an entry with its context, and the entries the way `workspaceState` keeps them."
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

(defn walk
  "Returns where walking `direction`, `:back` or `:forward`, from `position` in `entries` lands: an entry
   as `{:position p}`, past the newest entry as `{:position nil}`, or nil when there is nowhere to go."
  [entries position direction]
  (let [last-index (dec (count entries))]
    (case direction
      :back (cond
              (neg? last-index) nil
              (nil? position) {:position last-index}
              (pos? position) {:position (dec position)})
      :forward (cond
                 (nil? position) nil
                 (< position last-index) {:position (inc position)}
                 :else {:position nil}))))

(defn- same-context?
  [context entry]
  (every? #(= (get context %) (get entry %)) [:repl-input.context/ns :repl-input.context/session-key]))

(defn recalled-lock
  "Returns the lock after recalling `entry` where the context is `context` with `lock`: `lock` when the
   entry was evaluated in the context's namespace and session, else the entry's context."
  [lock context entry]
  (if (same-context? context entry)
    lock
    (select-keys entry context-keys)))

(defn shown-text
  "Returns `text` with the cursor where walking `direction` leaves it: at the end of the first line after
   walking back, so that `up` walks on, and at the end of the text after walking forward."
  [text direction]
  (let [end (if (= :back direction)
              (or (string/index-of text "\n") (count text))
              (count text))]
    {:text text :selections [[end end]]}))

(defn walked
  "Returns what walking `direction` among `entries` does to the REPL Input `record`, where the context is
   `context` with `lock`: the `text`, `selections` and `lock` to show, and the record's new `position` and
   `stash`. The stash keeps the text, the lock and the context from before the walk, and walking past the
   newest entry brings them back. Returns nil when there is nowhere to go."
  [entries
   {:repl-input/keys [text selections] :repl-input.history/keys [position stash]}
   {:keys [lock context]}
   direction]
  (when-let [landing (walk entries position direction)]
    (let [stash (or stash {:text text :selections selections :lock lock :context context})]
      (if-let [landed (:position landing)]
        (let [landed-entry (get entries landed)]
          (assoc (shown-text (:repl-input.history/code landed-entry) direction)
                 :position landed
                 :stash stash
                 :lock (recalled-lock (:lock stash) (:context stash) landed-entry)))
        (assoc (select-keys stash [:text :selections])
               :position nil
               :stash nil
               :lock (:lock stash))))))

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
