(ns calva.repl.input.definition
  "Where go to definition leads from the REPL Inputs, and from files to what REPL Input evaluations
   defined: the file names that the evaluations are sent with, the read-only history entries, and the
   targets that the REPL and clojure-lsp report.")

(def scheme
  "The scheme of the read-only editors that show history entries."
  "calva-repl-input")

(defn evaluation-file
  "Returns the file name that the evaluation `id` is sent with."
  [id]
  (str "calva-repl-input/" id ".clj"))

(defn- path-id
  [re s]
  (some->> s (re-matches re) second js/parseInt))

(defn evaluation-id
  "Returns the id of the REPL Input evaluation that `file` is the file name of, or nil for other files."
  [file]
  (path-id #"calva-repl-input/(\d+)\.clj" file))

(defn- entry
  [entries id]
  (some #(when (= id (:repl-input.history/id %)) %) entries))

(defn entry-location
  "Returns where the definition at `line` and `column`, as the REPL reports them, is in the read-only
   editor of the history entry of the evaluation `id`: its `:uri`, and the zero-based `:line` and
   `:character`. Returns nil when `entries` have no entry with that id."
  [entries id {:keys [line column]}]
  (when (entry entries id)
    {:uri (str scheme ":/" id ".clj")
     :line (max 0 (dec line))
     :character (max 0 (dec (or column 1)))}))

(defn entry-code
  "Returns the code of the history entry that `path`, the path of a read-only editor's uri, names, or nil."
  [entries path]
  (some->> (path-id #"/(\d+)\.clj" path)
           (entry entries)
           :repl-input.history/code))

(defn repl-target
  "Returns where the definition the REPL reports in `file` at `line` and `column` leads: a REPL Input
   evaluation, or the file."
  [{:keys [file line column] :as definition}]
  (if-let [id (evaluation-id file)]
    {:target :evaluation :id id :line line :column column}
    {:target :repl-file :definition definition}))

(defn lsp-target
  "Returns where the definition clojure-lsp reports at `uri`, `line` and `character` leads, when it
   completes in the copy whose REPL Input text starts at `text-line`, below the followed file at
   `document-uri`: the reported place, the followed file for a place in its part of the copy, or nil
   for a place in the REPL Input's text or in the `ns` form above it."
  [{:keys [text-line document-uri]} {:keys [uri line character inCopy] :as reported}]
  (cond
    (nil? reported) nil
    (not inCopy) {:target :location :uri uri :line line :character character}
    (and document-uri (< line text-line)) {:target :location :uri document-uri :line line :character character}))

(defn revealing-view
  "Returns the id of the Output view to reveal among `answers`, those that have the evaluated code block,
   a visible one first."
  [answers]
  (->> answers
       (filter :found?)
       (sort-by (complement :visible?))
       first
       :view-id))
