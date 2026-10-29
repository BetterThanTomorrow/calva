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
       (< (:version change) version)))

(defn take-change
  "Returns `records` with the REPL Input's record from `change`, unless `change` is older than the record.
   A change at the record's version replaces what `take-edit` expected of that version."
  [records {:repl-input/keys [id] :as change}]
  (if (stale? (get records id) change)
    records
    (update records id merge (message->record change))))

(defn take-edit
  "Returns `records` with the REPL Input's record at the version after `version`, with the `text`,
   `selections` and `selections-stack` of an edit made from `version`. The edit is dropped when the
   record is no longer at `version`."
  [records id version {:keys [text selections selections-stack]}]
  (if (= version (get-in records [id :repl-input/version]))
    (update records id assoc
            :repl-input/version (inc version)
            :repl-input/text text
            :repl-input/selections selections
            :repl-input/selections-stack selections-stack)
    records))

(defn restored
  "Returns the text and selections that `record` keeps from before its REPL Input mounted again, for the
   REPL Input to get back, or nil when the record has no text."
  [{:repl-input/keys [text selections]}]
  (when (seq text)
    {:text text :selections selections}))

(defn take-mount
  "Returns `records` with the REPL Input's record replaced by the freshly mounted one."
  [records {:repl-input/keys [id] :as mount}]
  (assoc records id (message->record mount)))

(defn remove-record
  [records id]
  (dissoc records id))
