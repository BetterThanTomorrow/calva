(ns calva.repl.webview.printed-brackets
  "Calva's rainbow brackets for printed code in the Output views, painted by the painter Calva paints files with,
   under the `calva.highlight` settings."
  (:require
   [calva.repl.input.brackets :as brackets]
   [calva.repl.input.host :as input-host]
   [calva.util :as util]))

(defn settings
  "Returns the `calva.highlight` settings the brackets depend on, as a map from setting keys to values."
  []
  (when-let [^js vscode @util/vscode]
    (let [^js config (.. vscode -workspace getConfiguration)]
      (into {} (map (fn [k] [k (js->clj (.get config k))])) brackets/highlight-settings))))

(defn brackets
  "Returns the brackets and the forms the painter marks in printed `text` under the `settings`, as the
   REPL Input gets them, without matched brackets, since printed code has no cursor. Nil without the adapter."
  [text settings]
  (when-let [^js adapter @input-host/!adapter]
    (-> (.brackets adapter
                   (.document adapter text #js [#js [0 0]])
                   (clj->js (brackets/rainbow-options settings)))
        (js->clj :keywordize-keys true)
        (dissoc :matched))))
