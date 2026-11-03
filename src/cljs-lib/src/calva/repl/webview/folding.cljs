(ns calva.repl.webview.folding
  "Which evaluation results the Output views show folded, and what a folded result says. The extension leaves
   out the highlighting of a result that will be folded, and the page draws it folded.")

(def max-unfolded-characters
  "The most characters of a result shown whole."
  5000)

(def max-unfolded-lines
  "The most lines of a result shown whole."
  100)

(def ^:private start-length
  "How much of the first line a folded result shows."
  100)

(defn- line-count
  [text]
  (.-length (.split text "\n")))

(defn folded?
  "True when the printed result `text` is shown folded: over `max-unfolded-characters` characters or
   `max-unfolded-lines` lines."
  [text]
  (and (string? text)
       (or (> (count text) max-unfolded-characters)
           (> (line-count text) max-unfolded-lines))))

(defn start
  "Returns the start of the first line of `text`, as a folded result shows it, with an ellipsis when cut."
  [text]
  (let [newline (.indexOf text "\n")
        line (.replace (if (neg? newline) text (subs text 0 newline)) #"\r$" "")]
    (if (> (count line) start-length)
      (str (subs line 0 start-length) "…")
      line)))

(defn text-size
  "Returns `[characters lines]` of `text`."
  [text]
  [(count text) (line-count text)])

(defn size-text
  "Returns what a folded result says about its size, like \"52,341 characters, 1,500 lines\"."
  [characters lines]
  (let [grouped #(.toLocaleString % "en-US")]
    (str (grouped characters) " characters, " (grouped lines) (if (= 1 lines) " line" " lines"))))
