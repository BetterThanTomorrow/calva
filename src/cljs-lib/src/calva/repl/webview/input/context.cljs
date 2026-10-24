(ns calva.repl.webview.input.context
  "The context line above the REPL Input.")

(defn- child
  [class-name]
  (some-> (js/document.getElementById "repl-input") (.querySelector (str "." class-name))))

(defn- element
  [tag class-name]
  (doto (js/document.createElement tag)
    (-> .-className (set! class-name))))

(defn mount!
  "Adds the context line to `parent`. A click on it dispatches its action."
  [^js parent dispatch!]
  (let [line (element "div" "repl-input-context-line")]
    (.addEventListener line "click" #(dispatch! [:repl-input/ax.follow-editor]))
    (.append parent line)))

(defn- text-element
  [class-name text]
  (doto (element "span" class-name)
    (-> .-textContent (set! text))))

(defn set-line!
  [{:repl-input.context/keys [ns session hint locked? connected?]}]
  (when-let [^js line (child "repl-input-context-line")]
    (.replaceChildren line
                      (text-element "repl-input-context-ns" ns)
                      (text-element "repl-input-context-session" session)
                      (text-element "repl-input-context-hint" hint))
    (.. line -classList (toggle "locked" (boolean locked?)))
    (.. line -classList (toggle "not-connected" (not connected?)))
    (if locked?
      (.setAttribute line "role" "button")
      (.removeAttribute line "role"))))
