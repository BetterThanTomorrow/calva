(ns calva.repl.webview.input.context
  "The context line, with its mode and play buttons, and the evaluation bar above the REPL Input."
  (:require
   [calva.repl.webview.input.stdin :as stdin]
   [calva.repl.webview.input.tooltip :as tooltip]
   [clojure.string :as string]))

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
  "Returns the action of a click at `target` on the context line: on its connect link, or nil."
  [^js target]
  (when (.closest target ".repl-input-context-connect")
    [:repl-input/ax.connect]))

(def ^:private evaluate-title "Evaluate REPL Input")

(def ^:private connect-title "Connect a REPL to enable evaluations")

(def ^:private play-path
  "The codicon `play`."
  "M4.74514 3.06414C4.41183 2.87665 4 3.11751 4 3.49993V12.5002C4 12.8826 4.41182 13.1235 4.74512 12.936L12.7454 8.43601C13.0852 8.24486 13.0852 7.75559 12.7454 7.56443L4.74514 3.06414ZM3 3.49993C3 2.35268 4.2355 1.63011 5.23541 2.19257L13.2357 6.69286C14.2551 7.26633 14.2551 8.73415 13.2356 9.30759L5.23537 13.8076C4.23546 14.37 3 13.6474 3 12.5002V3.49993Z")

(def ^:private link-path
  "The codicon `link`."
  "M9.49999 4H10.5C12.433 4 14 5.567 14 7.5C14 9.36856 12.5357 10.8951 10.6941 10.9948L10.5023 11L9.5023 11.0046C9.22616 11.0059 9.00127 10.783 8.99999 10.5069C8.99888 10.2614 9.17481 10.0565 9.40787 10.0131L9.4977 10.0046L10.5 10C11.8807 10 13 8.88071 13 7.5C13 6.17452 11.9685 5.08996 10.6644 5.00532L10.5 5H9.49999C9.22386 5 8.99999 4.77614 8.99999 4.5C8.99999 4.25454 9.17687 4.05039 9.41012 4.00806L9.49999 4H10.5H9.49999ZM5.5 4H6.5C6.77614 4 7 4.22386 7 4.5C7 4.74546 6.82312 4.94961 6.58988 4.99194L6.5 5H5.5C4.11929 5 3 6.11929 3 7.5C3 8.82548 4.03154 9.91004 5.33562 9.99468L5.5 10H6.5C6.77614 10 7 10.2239 7 10.5C7 10.7455 6.82312 10.9496 6.58988 10.9919L6.5 11H5.5C3.567 11 2 9.433 2 7.5C2 5.63144 3.46428 4.10487 5.30796 4.00518L5.5 4H6.5H5.5ZM5.50023 7L10.5002 7.0023C10.7764 7.00242 11.0001 7.22638 11 7.50252C10.9999 7.74798 10.8229 7.95205 10.5897 7.99428L10.4998 8.0023L5.49977 8C5.22363 7.99987 4.99987 7.77591 5 7.49977C5.00011 7.25431 5.17708 7.05024 5.41035 7.00801L5.50023 7Z")

(def ^:private lock-path
  "The codicon `lock`, its two paths in one, drawn with the even-odd fill rule."
  "M8 9C8.55228 9 9 9.44771 9 10C9 10.5523 8.55228 11 8 11C7.44772 11 7 10.5523 7 10C7 9.44771 7.44772 9 8 9ZM8 1C9.654 1 11 2.346 11 4V6H12C13.103 6 14 6.897 14 8V13C14 14.103 13.103 15 12 15H4C2.897 15 2 14.103 2 13V8C2 6.897 2.897 6 4 6H5V4C5 2.346 6.346 1 8 1ZM4 7C3.449 7 3 7.449 3 8V13C3 13.551 3.449 14 4 14H12C12.551 14 13 13.551 13 13V8C13 7.449 12.551 7 12 7H4ZM8 2C6.897 2 6 2.897 6 4V6H10V4C10 2.897 9.103 2 8 2Z")

(def ^:private icon-paths {:link link-path :lock lock-path})

(def ^:private following-title
  "Following the editor. Click to lock the namespace and session. Evaluating an ns or in-ns form locks too.")

(def ^:private locked-title "Locked. Click to follow the editor.")

(defn- entry-title
  [{:repl-input.context/keys [ns session-key]}]
  (str "Following the editor. Click to lock the history entry's namespace and session: "
       (string/join " · " (remove nil? [ns session-key]))))

(defn mode-button
  "Returns what the mode button shows for the `context-line` and the `entry-lock`, the lock of a shown
   history entry from another context: its icon, whether it offers the entry's lock, and its tooltip."
  [{:repl-input.context/keys [locked?]} entry-lock]
  (cond
    locked? {:repl-input.mode/icon :lock :repl-input.mode/entry? false :repl-input.mode/title locked-title}
    entry-lock {:repl-input.mode/icon :link :repl-input.mode/entry? true :repl-input.mode/title (entry-title entry-lock)}
    :else {:repl-input.mode/icon :link :repl-input.mode/entry? false :repl-input.mode/title following-title}))

(defn- set-mode-button!
  "Shows the icon and the tooltip of the `mode-button` on `button`."
  [^js button {:repl-input.mode/keys [icon entry? title]}]
  (tooltip/set-text! button title)
  (.setAttribute button "aria-label" title)
  (.. button -classList (toggle "entry" entry?))
  (.replaceChildren button (stdin/icon "repl-input-context-icon" (icon-paths icon))))

(defn- set-play-button!
  "Shows the play button `button` as disabled, with a tooltip that says to connect a REPL, unless
   `connected?`."
  [^js button connected?]
  (.setAttribute button "aria-disabled" (str (not connected?)))
  (tooltip/set-text! button (if connected? evaluate-title connect-title)))

(defn- context-button
  "Returns a button of the class `class-name` on the context line, which dispatches `action` when clicked
   and keeps the focus where it is."
  [class-name action dispatch!]
  (doto (element "button" (str "repl-input-context-button " class-name))
    (.addEventListener "mousedown" #(.preventDefault ^js %))
    (.addEventListener "click" #(dispatch! action))))

(defn mount!
  "Adds the context line with its mode and play buttons, and the evaluation bar, to `parent`. A click on
   the connect link, on a button, or on Interrupt, dispatches its action."
  [^js parent dispatch!]
  (let [row (element "div" "repl-input-context")
        line (element "div" "repl-input-context-line")
        mode (context-button "repl-input-mode" [:repl-input/ax.toggle-lock] dispatch!)
        play (context-button "repl-input-evaluate" [:repl-input/ax.evaluate] dispatch!)
        bar (element "div" "repl-input-evaluation-bar")
        interrupt (element "button" "repl-input-interrupt")]
    (.addEventListener line "click" #(some-> (click-action (.-target ^js %)) dispatch!))
    (doto play
      (.setAttribute "aria-label" evaluate-title)
      (.append (stdin/icon "repl-input-context-icon" play-path)))
    (.append row
             line
             mode
             (tooltip/element mode "repl-input-mode-tooltip" "")
             play
             (tooltip/element play "repl-input-evaluate-tooltip" ""))
    (set! (.-textContent interrupt) "Interrupt")
    (.addEventListener interrupt "click" #(dispatch! [:repl-input/ax.interrupt]))
    (set! (.-hidden bar) true)
    (.append bar (text-element "repl-input-evaluation-text" "Evaluating…") interrupt)
    (.append parent row bar)
    (set-mode-button! mode (mode-button nil nil))
    (set-play-button! play false)))

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

(defn set-line!
  "Shows the namespace and session of the `context-line`, a link that connects a REPL while no session
   answers to its key, the mode button for the line and the `entry-lock`, the lock of a shown history
   entry from another context, and the play button, disabled while no session answers."
  [{:repl-input.context/keys [ns connected?] :as context-line} entry-lock]
  (when-let [^js line (child "repl-input-context-line")]
    (.replaceChildren line (text-element "repl-input-context-ns" ns))
    (run! #(.append line %) (session-elements context-line)))
  (when-let [^js button (child "repl-input-mode")]
    (set-mode-button! button (mode-button context-line entry-lock)))
  (when-let [^js button (child "repl-input-evaluate")]
    (set-play-button! button connected?)))

(defn set-evaluation!
  "Shows the evaluation bar while an `evaluation` is `:running`, and hides it otherwise. The stdin input
   shows for one that reads stdin."
  [evaluation]
  (when-let [^js bar (child "repl-input-evaluation-bar")]
    (set! (.-hidden bar) (not= :running evaluation))))
