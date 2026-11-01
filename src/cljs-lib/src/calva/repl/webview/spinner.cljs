(ns calva.repl.webview.spinner
  "The spinner that shows while an evaluation runs.")

(def ^:private loading-path
  "The codicon `loading`."
  "M13.5 8.5C13.224 8.5 13 8.276 13 8C13 5.243 10.757 3 8 3C5.243 3 3 5.243 3 8C3 8.276 2.776 8.5 2.5 8.5C2.224 8.5 2 8.276 2 8C2 4.691 4.691 2 8 2C11.309 2 14 4.691 14 8C14 8.276 13.776 8.5 13.5 8.5Z")

(defn element
  "Returns the spinner, an `svg` of the `classes`, as hiccup."
  [classes]
  [:svg {:class (into ["evaluation-spinner"] classes)
         :viewBox "0 0 16 16"
         :role "img"
         :aria-label "Evaluating"}
   [:path {:d loading-path}]])

(defn end-evaluation!
  "Removes the spinners of the evaluation `evaluation-id` in `dom-element`."
  [^js dom-element evaluation-id]
  (doseq [^js spinner (array-seq (.querySelectorAll dom-element (str "[data-evaluation-id=\"" evaluation-id "\"] .evaluation-spinner")))]
    (.remove spinner)))
