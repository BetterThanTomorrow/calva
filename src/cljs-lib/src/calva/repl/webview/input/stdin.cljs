(ns calva.repl.webview.input.stdin
  "The stdin input between the output and the REPL Input, where an evaluation that reads stdin gets its
   line."
  (:require
   [calva.repl.webview.tooltip :as tooltip]))

(def placeholder "(read-line) reads the next line · enter sends it")

(def ^:private chevron-right-path
  "The codicon `chevron-right`."
  "M6.14601 3.14579C5.95101 3.34079 5.95101 3.65779 6.14601 3.85279L10.292 7.99879L6.14601 12.1448C5.95101 12.3398 5.95101 12.6568 6.14601 12.8518C6.34101 13.0468 6.65801 13.0468 6.85301 12.8518L11.353 8.35179C11.548 8.15679 11.548 7.83979 11.353 7.64478L6.85301 3.14479C6.65801 2.94979 6.34101 2.95079 6.14601 3.14579Z")

(def ^:private debug-stop-path
  "The codicon `debug-stop`."
  "M12.5 3.5V12.5H3.5V3.5H12.5ZM12.5 2H3.5C2.672 2 2 2.672 2 3.5V12.5C2 13.328 2.672 14 3.5 14H12.5C13.328 14 14 13.328 14 12.5V3.5C14 2.672 13.328 2 12.5 2Z")

(defn icon
  "Returns an `svg` of the `classes` that draws the codicon with `path-data`, as hiccup."
  [classes path-data]
  [:svg {:class classes :viewBox "0 0 16 16" :aria-hidden "true"}
   [:path {:d path-data}]])

(defn- row-element
  []
  (some-> (js/document.getElementById "repl-input") (.querySelector ".repl-input-stdin")))

(defn input-element
  "Returns the stdin input's `input` element while it shows, or nil."
  []
  (when-let [^js stdin-row (row-element)]
    (when-not (.-hidden stdin-row)
      (.querySelector stdin-row "input"))))

(defn on-keydown
  "Dispatches the line on `enter`, and interrupt on `escape`."
  [dispatch! ^js event]
  (when-not (.-isComposing event)
    (when-let [action (case (.-key event)
                        "Enter" [:repl-input/ax.send-line (.. event -target -value)]
                        "Escape" [:repl-input/ax.interrupt]
                        nil)]
      (.preventDefault event)
      (dispatch! action))))

(defn row
  "Returns the stdin input, shown while `reading?`, as hiccup. Its keydowns call `on-input-keydown`."
  [reading? on-input-keydown]
  [:div {:class "repl-input-stdin" :hidden (not reading?)}
   (icon ["repl-input-stdin-icon" "repl-input-stdin-prompt"] chevron-right-path)
   [:input {:type "text"
            :placeholder placeholder
            :spellcheck "false"
            :aria-label "stdin"
            :on {:keydown on-input-keydown}}]
   [:button (merge {:class "repl-input-stdin-stop"
                    :aria-label "Interrupt"
                    :on {:click [[:repl-input/ax.interrupt]]}}
                   (tooltip/attributes "Interrupt (escape)"))
    (icon ["repl-input-stdin-icon"] debug-stop-path)]])

(defn clear!
  "Empties the stdin input, and returns its `input` element."
  []
  (some-> (row-element) (.querySelector "input") (doto (-> .-value (set! "")))))

(defn focused?
  "True when the stdin input has the focus."
  []
  (some-> (row-element) (.querySelector "input") (= js/document.activeElement)))
