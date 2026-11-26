(ns calva.repl.webview.input.definition
  "Go to definition on click in the REPL Input, with the modifier that `editor.multiCursorModifier` leaves
   for it, as in files."
  (:require
   ["@codemirror/view" :refer [EditorView]]))

(defn definition-click?
  "True when `click` goes to the definition: cmd on macOS, or ctrl elsewhere, while alt adds cursors by
   `multi-cursor-modifier`, and alt while cmd or ctrl adds them."
  [{:keys [multi-cursor-modifier mac?]} {:keys [button alt? ctrl? meta? shift?]}]
  (let [modifier (cond
                   (= "ctrlCmd" multi-cursor-modifier) :alt?
                   mac? :meta?
                   :else :ctrl?)]
    (and (zero? button)
         (not shift?)
         (= #{modifier} (set (keep (fn [[k pressed?]] (when pressed? k))
                                   {:alt? alt? :ctrl? ctrl? :meta? meta?}))))))

(defn- click
  [^js event]
  {:button (.-button event)
   :alt? (.-altKey event)
   :ctrl? (.-ctrlKey event)
   :meta? (.-metaKey event)
   :shift? (.-shiftKey event)})

(defn click-extension
  "Dispatches going to the definition at the click, for clicks that `definition-click?` says go there with
   `settings`. The click also moves the cursor there."
  [dispatch! settings]
  (.domEventHandlers EditorView
                     #js {:mousedown (fn [^js event ^js view]
                                       (when (definition-click? settings (click event))
                                         (when-let [offset (.posAtCoords view #js {:x (.-clientX event) :y (.-clientY event)})]
                                           (dispatch! [:repl-input/ax.reveal-definition {:text (.. view -state -doc toString)
                                                                                         :offset offset}])))
                                       false)}))
