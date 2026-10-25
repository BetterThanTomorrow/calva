(ns calva.repl.webview.input.context
  "The context line and the evaluation bar above the REPL Input.")

(defn- child
  [class-name]
  (some-> (js/document.getElementById "repl-input") (.querySelector (str "." class-name))))

(defn- element
  [tag class-name]
  (doto (js/document.createElement tag)
    (-> .-className (set! class-name))))

(defn- text-element
  [class-name text]
  (doto (element "span" class-name)
    (-> .-textContent (set! text))))

(defn- click-action
  "Returns the action of a click at `target` on the context line: on its connect link, on its lock link,
   or elsewhere on the line."
  [^js target]
  (cond
    (.closest target ".repl-input-context-connect") [:repl-input/ax.connect]
    (.closest target ".repl-input-context-lock") [:repl-input/ax.lock-entry]
    :else [:repl-input/ax.follow-editor]))

(defn mount!
  "Adds the context line and the evaluation bar to `parent`. A click on the context line, on its connect
   or lock link, or on Interrupt, dispatches its action."
  [^js parent dispatch!]
  (let [line (element "div" "repl-input-context-line")
        bar (element "div" "repl-input-evaluation-bar")
        interrupt (element "button" "repl-input-interrupt")]
    (.addEventListener line "click" #(dispatch! (click-action (.-target ^js %))))
    (set! (.-textContent interrupt) "Interrupt")
    (.addEventListener interrupt "click" #(dispatch! [:repl-input/ax.interrupt]))
    (set! (.-hidden bar) true)
    (.append bar (text-element "repl-input-evaluation-text" "Evaluating…") interrupt)
    (.append parent line bar)))

(def ^:private following "following the editor")

(def ^:private following-hint (str following " · an ns or in-ns form locks the namespace"))

(def ^:private locked-hint "locked · click to follow the editor")

(defn- connect-link-element
  []
  (doto (text-element "repl-input-context-connect" "Connect a REPL")
    (.setAttribute "role" "button")))

(defn- session-elements
  "Returns the session key of the `context-line`, and the connect link while no session answers to it."
  [{:repl-input.context/keys [session-key connected?]}]
  (cond-> []
    session-key (conj (text-element "repl-input-context-session" session-key))
    (not connected?) (conj (connect-link-element))))

(defn- hint
  "Returns how to change the context, or only that it follows the editor when the lock link shows."
  [locked? lock-link]
  (cond
    locked? locked-hint
    lock-link following
    :else following-hint))

(defn- lock-link-element
  [{:repl-input.context/keys [ns]}]
  (doto (text-element "repl-input-context-lock" (str "lock " ns))
    (.setAttribute "role" "button")))

(defn set-line!
  "Shows the namespace and session of the `context-line`, a link that connects a REPL while no session
   answers to its key, how to change them, and while the REPL Input shows a history entry from another
   context, the `lock-link` that locks the entry's."
  [{:repl-input.context/keys [ns locked?] :as context-line} lock-link]
  (when-let [^js line (child "repl-input-context-line")]
    (.replaceChildren line (text-element "repl-input-context-ns" ns))
    (run! #(.append line %) (session-elements context-line))
    (.append line (text-element "repl-input-context-hint" (hint locked? lock-link)))
    (when lock-link
      (.append line (lock-link-element lock-link)))
    (.. line -classList (toggle "locked" (boolean locked?)))
    (if locked?
      (.setAttribute line "role" "button")
      (.removeAttribute line "role"))))

(defn set-evaluation!
  "Shows the evaluation bar while an `evaluation` is `:running`, and hides it otherwise. The stdin input
   shows for one that reads stdin."
  [evaluation]
  (when-let [^js bar (child "repl-input-evaluation-bar")]
    (set! (.-hidden bar) (not= :running evaluation))))
