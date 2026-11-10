(ns calva.repl.webview.folding
  "Which evaluation results the Output views show folded, and what a folded result says. The extension decides,
   leaves out the highlighting of a result that will be folded and marks its message, and the page draws it
   folded.")

(defn folded?
  "True when the printed result `text` is longer than `max-characters`, the setting
   `calva.outputViews.foldResultsLongerThan`. With 0, nothing folds."
  [text max-characters]
  (and (string? text)
       (pos? max-characters)
       (> (count text) max-characters)))

(def ^:private start-length
  "How much of the first line a folded result shows."
  100)

(defn start
  "Returns the start of the first line of `text`, as a folded result shows it, with an ellipsis when cut."
  [text]
  (let [newline (.indexOf text "\n")
        line (.replace (if (neg? newline) text (subs text 0 newline)) #"\r$" "")]
    (if (> (count line) start-length)
      (str (subs line 0 start-length) "…")
      line)))

(defn- line-count
  [text]
  (.-length (.split text "\n")))

(defn text-size
  "Returns `[characters lines]` of `text`."
  [text]
  [(count text) (line-count text)])

(defn size-text
  "Returns what a folded result says about its size, like \"52,341 characters, 1,500 lines\"."
  [characters lines]
  (let [grouped #(.toLocaleString % "en-US")]
    (str (grouped characters) " characters, " (grouped lines) (if (= 1 lines) " line" " lines"))))
