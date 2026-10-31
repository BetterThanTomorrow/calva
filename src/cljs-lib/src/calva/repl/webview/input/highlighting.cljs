(ns calva.repl.webview.input.highlighting
  "The REPL Input's highlighting in CodeMirror: the extension's grammar and semantic token layers, moved along
   with the edits, colored with a class for each color."
  (:require
   [calva.repl.webview.input.highlight :as highlight]
   ["@codemirror/state" :refer [StateEffect StateField]]
   ["@codemirror/view" :refer [Decoration EditorView]]))

(defn mark-decorations
  [ranges]
  (.set Decoration
        (into-array (for [[from to class-name] ranges]
                      (.range (.mark Decoration #js {:class class-name}) from to)))
        true))

(def ^:private set-layer (.define StateEffect))

(defn- color-decorations
  [ranges]
  (mark-decorations (for [[from to color] ranges
                          :let [class-name (highlight/color-class color)]
                          :when class-name]
                      [from to class-name])))

(defn- highlighted
  "Returns the field's value for `layers`, the extension's `:grammar` and `:semantic` ranges, or, before
   the extension posted any, for highlight.js's ranges in `text`."
  [layers text]
  {:layers layers
   :decorations (if layers
                  (color-decorations (highlight/layered (:grammar layers) (:semantic layers)))
                  (mark-decorations (highlight/highlight-ranges text)))})

(defn- moved-layers
  [layers ^js transaction]
  (let [^js changes (.-changes transaction)]
    (cond-> layers
      (and layers (.-docChanged transaction))
      (update-vals #(highlight/mapped % (fn [pos assoc] (.mapPos changes pos assoc)))))))

(defn- posted-layers
  [layers ^js transaction]
  (reduce (fn [layers ^js effect]
            (if (.is effect set-layer)
              (let [[layer ranges] (.-value effect)]
                (assoc layers layer ranges))
              layers))
          layers
          (.-effects transaction)))

(def field
  "The REPL Input's highlighting, with the extension's layers moved along with the edits until it posts
   them anew."
  (.define StateField
           #js {:create (fn [^js state] (highlighted nil (.. state -doc toString)))
                :update (fn [{:keys [layers] :as value} ^js transaction]
                          (let [layers-after (posted-layers (moved-layers layers transaction) transaction)]
                            (if (or (.-docChanged transaction) (not= layers-after layers))
                              (highlighted layers-after (.. transaction -state -doc toString))
                              value)))
                :provide (fn [state-field]
                           (.from (.-decorations EditorView) state-field (fn [value] (:decorations value))))}))

(defonce ^:private !color-sheet (atom nil))

(defonce ^{:private true :doc "The colors the color sheet has a class for."} !sheet-colors (atom #{}))

(defn- color-sheet
  []
  (or @!color-sheet
      (let [sheet (js/CSSStyleSheet.)]
        (set! (.-adoptedStyleSheets js/document) (.concat (.-adoptedStyleSheets js/document) #js [sheet]))
        (reset! !color-sheet sheet))))

(defn- add-color-classes!
  "Adds a class to the color sheet for each color of `ranges` it has none for."
  [ranges]
  (when-let [new-colors (->> (map #(nth % 2) ranges)
                             (filter highlight/color-class)
                             distinct
                             (remove @!sheet-colors)
                             seq)]
    (let [^js sheet (color-sheet)]
      (doseq [color new-colors]
        (.insertRule sheet (str "." (highlight/color-class color) " { color: " color "; }") (.. sheet -cssRules -length)))
      (swap! !sheet-colors into new-colors))))

(defn set-layer!
  "Sets the `layer`, `:grammar` or `:semantic`, of the highlighting in `view` to `ranges`."
  [^js view layer ranges]
  (add-color-classes! ranges)
  (.dispatch view #js {:effects (.of set-layer [layer ranges])}))
