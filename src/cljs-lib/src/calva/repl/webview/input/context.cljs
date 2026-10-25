(ns calva.repl.webview.input.context
  "The context line, with its play button, and the evaluation bar above the REPL Input."
  (:require
   [calva.repl.webview.input.stdin :as stdin]))

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

(def ^:private evaluate-title "Evaluate REPL Input")

(def ^:private play-path
  "The codicon `play`."
  "M4.74514 3.06414C4.41183 2.87665 4 3.11751 4 3.49993V12.5002C4 12.8826 4.41182 13.1235 4.74512 12.936L12.7454 8.43601C13.0852 8.24486 13.0852 7.75559 12.7454 7.56443L4.74514 3.06414ZM3 3.49993C3 2.35268 4.2355 1.63011 5.23541 2.19257L13.2357 6.69286C14.2551 7.26633 14.2551 8.73415 13.2356 9.30759L5.23537 13.8076C4.23546 14.37 3 13.6474 3 12.5002V3.49993Z")

(defn- play-button
  "Returns the play button, which keeps the focus where it is when clicked."
  [dispatch!]
  (doto (element "button" "repl-input-evaluate")
    (-> .-title (set! evaluate-title))
    (.setAttribute "aria-label" evaluate-title)
    (.append (stdin/icon "repl-input-evaluate-icon" play-path))
    (.addEventListener "mousedown" #(.preventDefault ^js %))
    (.addEventListener "click" #(dispatch! [:repl-input/ax.evaluate]))))

(defn mount!
  "Adds the context line with its play button, and the evaluation bar, to `parent`. A click on the context
   line, on its connect or lock link, on the play button, or on Interrupt, dispatches its action."
  [^js parent dispatch!]
  (let [row (element "div" "repl-input-context")
        line (element "div" "repl-input-context-line")
        bar (element "div" "repl-input-evaluation-bar")
        interrupt (element "button" "repl-input-interrupt")]
    (.addEventListener line "click" #(dispatch! (click-action (.-target ^js %))))
    (.append row line (play-button dispatch!))
    (set! (.-textContent interrupt) "Interrupt")
    (.addEventListener interrupt "click" #(dispatch! [:repl-input/ax.interrupt]))
    (set! (.-hidden bar) true)
    (.append bar (text-element "repl-input-evaluation-text" "Evaluating…") interrupt)
    (.append parent row bar)))

(defn set-evaluate-key!
  "Shows `evaluate-key`, the key of Evaluate REPL Input, in the play button's tooltip, or no key when it
   is nil."
  [evaluate-key]
  (when-let [^js button (child "repl-input-evaluate")]
    (set! (.-title button) (cond-> evaluate-title
                             evaluate-key (str " (" evaluate-key ")")))))

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
