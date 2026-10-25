(ns calva.repl.input.definition
  "Where go to definition leads from the REPL Inputs, and from files to what REPL Input evaluations
   defined: the file names that the evaluations are sent with, the code each evaluation kept for its
   read-only entry, and the targets that the REPL and clojure-lsp report.")

(def scheme
  "The scheme of the read-only editors that show what REPL Input evaluations evaluated."
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

(def kept-count
  "How many of the latest REPL Input evaluations keep their code."
  500)

(defn evaluation
  "Returns the evaluation `id` of `code`, which started at the zero-based `line` and `column` of the REPL Input."
  [id code line column]
  {:repl-input.evaluation/id id
   :repl-input.evaluation/code code
   :repl-input.evaluation/line (or line 0)
   :repl-input.evaluation/column (or column 0)})

(defn add-evaluation
  "Returns `evaluations` with `evaluation` last, keeping the latest `kept-count`."
  [evaluations evaluation]
  (let [added (conj (vec evaluations) evaluation)]
    (subvec added (max 0 (- (count added) kept-count)))))

(defn- find-evaluation
  [evaluations id]
  (some #(when (= id (:repl-input.evaluation/id %)) %) evaluations))

(defn entry-location
  "Returns where the definition at `line` and `column`, as the REPL reports them, is in the read-only
   entry of the evaluation `id`, which shows the code as it was evaluated: its `:uri`, and the zero-based
   `:line` and `:character`. Returns nil when `evaluations` don't keep the code of `id`."
  [evaluations id {:keys [line column]}]
  (when-let [{start-line :repl-input.evaluation/line
              start-column :repl-input.evaluation/column} (find-evaluation evaluations id)]
    (let [entry-line (max 0 (- (dec line) start-line))]
      {:uri (str scheme ":/" id ".clj")
       :line entry-line
       :character (max 0 (- (dec (or column 1)) (if (zero? entry-line) start-column 0)))})))

(defn entry-code
  "Returns the code of the evaluation that `path`, the path of a read-only entry's uri, names, or nil."
  [evaluations path]
  (some->> (path-id #"/(\d+)\.clj" path)
           (find-evaluation evaluations)
           :repl-input.evaluation/code))

(defn stored
  "Returns `evaluations` the way `workspaceState` keeps them."
  [evaluations]
  (mapv (fn [{:repl-input.evaluation/keys [id code line column]}]
          {:id id :code code :line line :column column})
        evaluations))

(defn from-stored
  "Returns the evaluations that `workspaceState` kept as `stored`, skipping what isn't an evaluation."
  [stored]
  (into []
        (comp (filter (every-pred map? (comp string? :code)))
              (map (fn [{:keys [id code line column]}] (evaluation id code line column))))
        stored))

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
