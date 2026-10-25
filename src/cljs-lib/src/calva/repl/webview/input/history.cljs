(ns calva.repl.webview.input.history
  "The REPL Input walks its copy of the history in the Output view's page: when `up` and `down` walk it
   instead of moving the cursor, what walking shows, and the lock or following the editor that walking
   asks for.")

(defn walk-direction
  "Returns `:back` for `up` on the first line and `:forward` for `down` on the last line, while there is
   one cursor and the completion list is closed. Else nil, and the key moves the cursor."
  [{:keys [key cursors cursor-line line-count completion-open?]}]
  (when (and (= 1 cursors) (not completion-open?))
    (case key
      :up (when (= 1 cursor-line) :back)
      :down (when (= line-count cursor-line) :forward)
      nil)))

(defn- walk
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

(defn- shown-text
  "Returns `text` with the cursor at its start when `at-start?`, else at its end."
  [text at-start?]
  (let [cursor (if at-start? 0 (count text))]
    {:text text :selections [[cursor cursor]]}))

(def ^:private lock-keys
  [:repl-input.context/ns :repl-input.context/ns-form :repl-input.context/session-key])

(defn- same-context?
  [context entry]
  (every? #(= (get context %) (get entry %)) [:repl-input.context/ns :repl-input.context/session-key]))

(defn- line-mode
  "Returns the mode of `context-line`: `[:locked lock]` with its namespace, `ns` form and session, or
   `[:following]`."
  [{:repl-input.context/keys [locked?] :as context-line}]
  (if locked?
    [:locked (select-keys context-line lock-keys)]
    [:following]))

(defn- same-mode?
  [[mode lock] [other-mode other-lock]]
  (and (= mode other-mode)
       (or (= :following mode) (same-context? lock other-lock))))

(defn- mode-at
  "Returns the mode that showing the history entry at `position` asks for: the lock of an entry from
   another context than the one before the walk, else the mode from before the walk."
  [{:repl-input.history/keys [entries stashed-line] :repl-input/keys [context-line]} position]
  (let [before (or stashed-line context-line)
        entry (some->> position (get entries))]
    (if (and entry (not (same-context? before entry)))
      [:locked (select-keys entry lock-keys)]
      (line-mode before))))

(defn- mode-change
  "Returns the mode that landing at `landing` asks for, when it differs from the mode at the walk's
   position, or from the context line's. Else nil."
  [{:repl-input.history/keys [position] :repl-input/keys [context-line] :as db} landing]
  (let [mode (mode-at db landing)]
    (when-not (and (same-mode? mode (mode-at db position))
                   (same-mode? mode (line-mode context-line)))
      mode)))

(defn- land
  "Returns `:db` showing the history entry at `position`, or the text from before the walk when `position`
   is nil, which ends the walk, the `:shown` text and selections, and the `:mode-change` it asks for. The
   cursor is at the start of an entry walked back to, and else at the end of the text. The stash keeps the
   text and the context line from before the walk."
  [{:repl-input/keys [text context-line] :repl-input.history/keys [entries stash stashed-line] :as db}
   position
   direction]
  (let [change (mode-change db position)
        landed (if position
                 {:db (assoc db
                             :repl-input.history/position position
                             :repl-input.history/stash (or stash text)
                             :repl-input.history/stashed-line (or stashed-line context-line))
                  :shown (shown-text (:repl-input.history/code (get entries position)) (= :back direction))}
                 {:db (dissoc db :repl-input.history/position :repl-input.history/stash :repl-input.history/stashed-line)
                  :shown (shown-text stash false)})]
    (cond-> landed
      change (assoc :mode-change change))))

(defn walked
  "Returns what walking the history `direction`, `:back` or `:forward`, does to `db`, as `land` does, or nil
   when there is nowhere to go."
  [{:repl-input.history/keys [entries position] :as db} direction]
  (when-let [landing (walk entries position direction)]
    (land db (:position landing) direction)))

(defn recalled
  "Returns what showing the history entry at `position`, as the history search picks it, does to `db`, as
   `land` does, or nil when the history has no such entry."
  [{:repl-input.history/keys [entries] :as db} position]
  (when (contains? entries position)
    (land db position :forward)))

(defn recalled-lock
  "Returns the namespace, `ns` form and session of the history entry that `db` shows, while the context line
   is locked to them and the walk began in another context. Else nil."
  [{:repl-input.history/keys [entries position stashed-line] :repl-input/keys [context-line]}]
  (when-let [entry (some->> position (get entries))]
    (when (and (:repl-input.context/locked? context-line)
               (same-context? context-line entry)
               (not (same-context? stashed-line entry)))
      (select-keys entry lock-keys))))
