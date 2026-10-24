(ns calva.repl.input.records
  "The extension's record of each REPL Input, keyed by `:repl-input/id`.")

(defn- message->record
  [{:keys [version text selections] :repl-input/keys [id]}]
  {:repl-input/id id
   :repl-input/version version
   :repl-input/text text
   :repl-input/selections selections})

(defn- stale?
  [{:repl-input/keys [version]} change]
  (and version
       (<= (:version change) version)))

(defn take-change
  "Returns `records` with the REPL Input's record from `change`, unless `change` is older than the record."
  [records {:repl-input/keys [id] :as change}]
  (if (stale? (get records id) change)
    records
    (assoc records id (message->record change))))

(defn take-mount
  "Returns `records` with the REPL Input's record replaced by the freshly mounted one."
  [records {:repl-input/keys [id] :as mount}]
  (assoc records id (message->record mount)))

(defn remove-record
  [records id]
  (dissoc records id))
