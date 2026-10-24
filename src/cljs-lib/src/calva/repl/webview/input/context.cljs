(ns calva.repl.webview.input.context
  "The context line and the evaluation bar above the REPL Input.")

(def reading-stdin-placeholder "(read-line) reads the next line")

(defn bar-text
  "Returns what the evaluation bar says while an evaluation is `:running` or `:reading-stdin`."
  [evaluation]
  (case evaluation
    :running "Evaluating…"
    :reading-stdin (str reading-stdin-placeholder " · enter sends it")
    ""))

(defn- child
  [class-name]
  (some-> (js/document.getElementById "repl-input") (.querySelector (str "." class-name))))

(defn- element
  [tag class-name]
  (doto (js/document.createElement tag)
    (-> .-className (set! class-name))))

(defn mount!
  "Adds the context line and the evaluation bar to `parent`. A click on the context line, or on
   Interrupt, dispatches its action."
  [^js parent dispatch!]
  (let [line (element "div" "repl-input-context-line")
        bar (element "div" "repl-input-evaluation-bar")
        interrupt (element "button" "repl-input-interrupt")]
    (.addEventListener line "click" #(dispatch! [:repl-input/ax.follow-editor]))
    (set! (.-textContent interrupt) "Interrupt")
    (.addEventListener interrupt "click" #(dispatch! [:repl-input/ax.interrupt]))
    (set! (.-hidden bar) true)
    (.append bar (element "span" "repl-input-evaluation-text") interrupt)
    (.append parent line bar)))

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

(defn set-evaluation!
  "Shows the evaluation bar while an `evaluation` is `:running` or `:reading-stdin`, and hides it when
   `evaluation` is nil."
  [evaluation]
  (when-let [^js bar (child "repl-input-evaluation-bar")]
    (set! (.-hidden bar) (nil? evaluation))
    (.. bar -classList (toggle "reading-stdin" (= :reading-stdin evaluation)))
    (set! (.-textContent (.querySelector bar ".repl-input-evaluation-text")) (bar-text evaluation))))
