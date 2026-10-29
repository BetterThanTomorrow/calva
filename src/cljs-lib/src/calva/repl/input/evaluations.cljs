(ns calva.repl.input.evaluations
  "The evaluations each REPL Input has running, by `:repl-input/id` and evaluation id, and whether one
   of them waits for a line from stdin.")

(defn next-id
  "Returns the id of the next evaluation: the time `now`, or one after `last-id` when that is later."
  [last-id now]
  (max (inc (or last-id 0)) now))

(defn started
  [evaluations id evaluation-id]
  (assoc-in evaluations [id evaluation-id] {:repl-input.evaluation/reading-stdin? false}))

(defn reading-stdin
  "Returns `evaluations` with the evaluation `evaluation-id` waiting for a line from stdin, or not, by
   `reading?`. An evaluation that has finished stays out."
  [evaluations id evaluation-id reading?]
  (if (get-in evaluations [id evaluation-id])
    (assoc-in evaluations [id evaluation-id :repl-input.evaluation/reading-stdin?] reading?)
    evaluations))

(defn finished
  [evaluations id evaluation-id]
  (let [remaining (dissoc (get evaluations id) evaluation-id)]
    (if (seq remaining)
      (assoc evaluations id remaining)
      (dissoc evaluations id))))

(defn waiting-for-stdin
  "Returns the id of the evaluation from the REPL Input `id` that waits for a line from stdin, or nil."
  [evaluations id]
  (some (fn [[evaluation-id {:repl-input.evaluation/keys [reading-stdin?]}]]
          (when reading-stdin? evaluation-id))
        (get evaluations id)))

(defn bar
  "Returns what the evaluation bar of the REPL Input `id` shows: `:reading-stdin`, `:running`, or nil."
  [evaluations id]
  (cond
    (waiting-for-stdin evaluations id) :reading-stdin
    (seq (get evaluations id)) :running))
