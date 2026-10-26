(ns calva.repl.webview.stacktrace
  "Errors with the causes cider-nrepl's stacktrace analyzer reports, as the Output views show them.")

(defn- nil-for-empty-list
  [m]
  (update-vals m #(if (and (sequential? %) (empty? %)) nil %)))

(defn- frame-data
  [frame]
  (-> (nil-for-empty-list frame)
      (update :flags set)))

(defn cause-data
  "Returns `cause`, a keywordized cause message from cider-nrepl, with nil for bencode's empty
   list, and `:flags` as a set."
  [cause]
  (-> (nil-for-empty-list (dissoc cause :id :session))
      (update :stacktrace #(mapv frame-data %))))

(defn has-frames?
  "True when any of the `causes` has frames."
  [causes]
  (boolean (some (comp seq :stacktrace) causes)))

(defn error-entry
  "Returns the entry an Output view keeps for an error with `causes`. It starts folded unless
   `unfolded?`, and the root cause shows its frames."
  [{:keys [id] :error/keys [text category causes unfolded?]}]
  {:error/id id
   :error/text text
   :error/category category
   :error/causes causes
   :error/unfolded? (boolean unfolded?)
   :error/unfolded-causes #{(dec (count causes))}})

(defn toggle-unfolded
  [error]
  (update error :error/unfolded? not))

(defn toggle-cause
  "Shows or hides the frames of the cause at `index`."
  [error index]
  (update error :error/unfolded-causes #(if (contains? % index) (disj % index) (conj % index))))

(defn frame-parts
  "Returns what an Output view shows for `frame`: file and line, then namespace and function for
   Clojure frames, or class and method for Java frames, and the file to open, if any."
  [{:keys [file line ns fn class method file-url]}]
  {:frame/location (str file ":" line)
   :frame/qualifier (or ns class)
   :frame/name (if ns fn method)
   :frame/file-url file-url
   :frame/line line})

(defn cause-heading
  [{:keys [class message]}]
  (str class ": " (or message "No message")))
