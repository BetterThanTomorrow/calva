(ns calva.repl.webview.input.history
  "The REPL Input walks its copy of the history in the Output view's page: when `up` and `down` walk it
   instead of moving the cursor, what walking shows, and the lock link the context line offers while an
   entry from another context shows."
  (:require
   [clojure.string :as string]))

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
  "Returns `text` with the cursor where walking `direction` leaves it: at the end of the first line after
   walking back, so that `up` walks on, and at the end of the text after walking forward."
  [text direction]
  (let [end (if (= :back direction)
              (or (string/index-of text "\n") (count text))
              (count text))]
    {:text text :selections [[end end]]}))

(defn- land
  "Returns `:db` showing the history entry at `position`, or the text from before the walk when `position`
   is nil, which ends the walk, and the `:shown` text and selections. The stash keeps the text from before
   the walk."
  [{:repl-input/keys [text selections] :repl-input.history/keys [entries stash] :as db} position direction]
  (let [stash (or stash {:text text :selections selections})]
    (if position
      {:db (assoc db :repl-input.history/position position :repl-input.history/stash stash)
       :shown (shown-text (:repl-input.history/code (get entries position)) direction)}
      {:db (dissoc db :repl-input.history/position :repl-input.history/stash)
       :shown stash})))

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

(defn- same-context?
  [context entry]
  (every? #(= (get context %) (get entry %)) [:repl-input.context/ns :repl-input.context/session-key]))

(defn lock-link
  "Returns the namespace, `ns` form and session of the history entry that `db` shows, when its namespace
   or session differs from the context line's. Else nil."
  [{:repl-input.history/keys [entries position] :repl-input/keys [context-line]}]
  (when-let [entry (some->> position (get entries))]
    (when-not (same-context? context-line entry)
      (select-keys entry [:repl-input.context/ns :repl-input.context/ns-form :repl-input.context/session-key]))))
