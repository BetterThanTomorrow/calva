(ns calva.repl.webview.printed-code.folds
  "The folds of printed code's editor: each form's text between its brackets, and the fold of a line."
  (:require
   [clojure.string :as string]))

(def ^:private closing
  {"(" ")" "[" "]" "{" "}"})

(defn forms
  "Returns the fold `[from to]` of each form in `text`, from after its open bracket to its close bracket, in
   the order the forms open. `brackets` are the painter's `[from to depth]` of the brackets in `text`. A
   bracket like `#{` is one range, opened by its last character."
  [text brackets]
  (loop [[[from to] & more] (sort-by first brackets)
         opens []
         folds []]
    (cond
      (nil? from) (vec (sort-by first folds))
      (closing (subs text (dec to) to)) (recur more (conj opens to) folds)
      (seq opens) (recur more (pop opens) (conj folds [(peek opens) from]))
      :else (recur more opens folds))))

(defn outermost-form
  "Returns the fold `[from to]` of the form that `text` is, when it starts with an open bracket, `#` and
   whitespace allowed before it, and ends with its close bracket, or nil."
  [text]
  (when-let [[opening open] (re-find #"^\s*#?([(\[{])" text)]
    (let [end (count (string/trimr text))]
      (when (= (closing open) (subs text (dec end) end))
        [(count opening) (dec end)]))))

(defn fold-at
  "Returns the fold `[from to]` of the line from `line-start` to `line-end`: of the first of the `forms` that
   opens on the line and closes on a later one, or nil. `forms` are in the order they open."
  [forms line-start line-end]
  (some (fn [[from to :as fold]]
          (when (and (< line-start from) (<= from line-end) (< line-end to))
            fold))
        forms))
