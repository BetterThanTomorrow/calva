(ns calva.repl.webview.input.highlighting
  "The REPL Input's highlighting in CodeMirror: the extension's grammar and semantic token layers, moved along
   with the edits, colored and styled with the classes of `calva.repl.webview.code-highlight`."
  (:require
   [calva.repl.webview.code-highlight :as code-highlight]
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

(defn- look-decorations
  [ranges]
  (mark-decorations (for [[from to color styles] ranges
                          :let [class-name (code-highlight/look-class color styles)]
                          :when class-name]
                      [from to class-name])))

(defn- highlighted
  "Returns the field's value for `layers`, the extension's `:grammar` and `:semantic` ranges, with no
   decorations before the extension posted any."
  [layers]
  {:layers layers
   :decorations (if layers
                  (look-decorations (highlight/layered (:grammar layers) (:semantic layers)))
                  (.-none Decoration))})

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
           #js {:create (fn [_] (highlighted nil))
                :update (fn [{:keys [layers] :as value} ^js transaction]
                          (let [layers-after (posted-layers (moved-layers layers transaction) transaction)]
                            (if (or (.-docChanged transaction) (not= layers-after layers))
                              (highlighted layers-after)
                              value)))
                :provide (fn [state-field]
                           (.from (.-decorations EditorView) state-field (fn [value] (:decorations value))))}))

(defn set-layer!
  "Sets the `layer`, `:grammar` or `:semantic`, of the highlighting in `view` to `ranges`."
  [^js view layer ranges]
  (code-highlight/add-classes! ranges)
  (.dispatch view #js {:effects (.of set-layer [layer ranges])}))
