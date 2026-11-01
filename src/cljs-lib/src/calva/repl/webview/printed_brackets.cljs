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

(defonce ^{:private true :doc "The last printed text painted, with its settings, and its brackets, as each Output view asks."}
  !last-painted (atom nil))

(defn brackets
  "Returns the brackets, the forms and the indent guides the painter marks in printed `text` under the
   `settings`, as the REPL Input gets them, without matched brackets and the guides of the forms around a
   cursor, since printed code has no cursor. Nil without the adapter."
  [text settings]
  (when-let [^js adapter @input-host/!adapter]
    (let [painted [text settings]
          {last-painted :painted :keys [brackets]} @!last-painted]
      (if (= painted last-painted)
        brackets
        (:brackets (reset! !last-painted
                           {:painted painted
                            :brackets (-> (.brackets adapter
                                                     (.document adapter text #js [#js [0 0]])
                                                     (clj->js (assoc (brackets/rainbow-options settings) :activeGuides false)))
                                          (js->clj :keywordize-keys true)
                                          (dissoc :matched))}))))))
