(ns calva.repl.webview.input.history
  "The REPL Input walks its copy of the history in the Output view's page: when `up` and `down` walk it
   instead of moving the cursor, what walking shows, and the lock or following the editor that the shown
   entry asks for, as walking lands on it and as the editor changes.")

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

(defn- entry-mode
  "Returns the mode that showing `entry` asks for while following the editor gives `editor-ns`: following
   the editor when the entry has that namespace, else locked to the entry's namespace, `ns` form and
   session."
  [entry editor-ns]
  (if (= editor-ns (:repl-input.context/ns entry))
    [:following]
    [:locked (select-keys entry lock-keys)]))

(defn- landing-mode
  "Returns the mode that landing at `position` asks for: the mode of its entry against the editor's
   namespace on the context line, or past the newest entry the mode from before the walk."
  [{:repl-input.history/keys [entries stashed-line] :repl-input/keys [context-line]} position]
  (if-let [entry (some->> position (get entries))]
    (entry-mode entry (:repl-input.context/editor-ns context-line))
    (line-mode (or stashed-line context-line))))

(defn- mode-change
  "Returns the `wanted` mode when it differs from the mode the walk's shown entry asks for, or from the
   context line's. Else nil."
  [{:repl-input.history/keys [mode] :repl-input/keys [context-line]} wanted]
  (when-not (every? #(same-mode? wanted %) (filter some? [mode (line-mode context-line)]))
    wanted))

(defn walk-ended
  "Returns `db` without the walk: its position, the stash, the mode the shown entry asks for, and the user's
   choice of it."
  [db]
  (dissoc db
          :repl-input.history/position
          :repl-input.history/stash
          :repl-input.history/stashed-line
          :repl-input.history/mode
          :repl-input.history/chosen?))

(defn- land
  "Returns `:db` showing the history entry at `position`, or the text from before the walk when `position`
   is nil, which ends the walk, the `:shown` text and selections, and the `:mode-change` it asks for. The
   cursor is at the start of an entry walked back to, and else at the end of the text. The stash keeps the
   text and the context line from before the walk."
  [{:repl-input/keys [text context-line] :repl-input.history/keys [entries stash stashed-line] :as db}
   position
   direction]
  (let [mode (landing-mode db position)
        change (mode-change db mode)
        landed (if position
                 {:db (-> db
                          (assoc :repl-input.history/position position
                                 :repl-input.history/stash (or stash text)
                                 :repl-input.history/stashed-line (or stashed-line context-line)
                                 :repl-input.history/mode mode)
                          (dissoc :repl-input.history/chosen?))
                  :shown (shown-text (:repl-input.history/code (get entries position)) (= :back direction))}
                 {:db (walk-ended db)
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

(defn with-context-line
  "Returns what the context line `line` arriving does to `db`: `:db` with the line, and the `:mode-change`
   that the shown history entry asks for when following the editor gives another namespace than before,
   until the user has chosen a mode."
  [{:repl-input/keys [context-line] :repl-input.history/keys [position chosen?] :as db} line]
  (let [with-line (assoc db :repl-input/context-line line)]
    (if (and position
             (not chosen?)
             (not= (:repl-input.context/editor-ns context-line) (:repl-input.context/editor-ns line)))
      (let [mode (landing-mode with-line position)]
        {:db (assoc with-line :repl-input.history/mode mode)
         :mode-change (mode-change with-line mode)})
      {:db with-line})))

(defn chosen
  "Returns `db` with the mode of the shown history entry as the user has chosen it, so that it stays when
   the editor changes. Without a shown entry, returns `db`."
  [{:repl-input.history/keys [position] :as db}]
  (cond-> db
    position (assoc :repl-input.history/chosen? true)))

(defn recalled-lock
  "Returns the namespace, `ns` form and session of the history entry that `db` shows, while the context line
   is locked to them. Else nil."
  [{:repl-input.history/keys [entries position] :repl-input/keys [context-line]}]
  (when-let [entry (some->> position (get entries))]
    (when (and (:repl-input.context/locked? context-line)
               (same-context? context-line entry))
      (select-keys entry lock-keys))))
