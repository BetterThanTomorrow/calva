(ns calva.repl.webview.input.context
  "The context line above the REPL Input, with its namespace indicator and menu and its play button, and
   the evaluation bar."
  (:require
   [calva.repl.webview.input.stdin :as stdin]
   [calva.repl.webview.tooltip :as tooltip]))

(defn- child
  [class-name]
  (some-> (js/document.getElementById "repl-input") (.querySelector (str "." class-name))))

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

(def ^:private chevron-down-path
  "The codicon `chevron-right`, turned to point down."
  "M12.8542 6.14601C12.6592 5.95101 12.3422 5.95101 12.1472 6.14601L8.00121 10.292L3.8552 6.14601C3.6602 5.95101 3.3432 5.95101 3.1482 6.14601C2.9532 6.34101 2.9532 6.65801 3.1482 6.85301L7.64821 11.353C7.84321 11.548 8.16021 11.548 8.35522 11.353L12.8552 6.85301C13.0502 6.65801 13.0492 6.34101 12.8542 6.14601Z")

(def ^:private indicator-looks
  "The icon, the tooltip and the label of the namespace indicator, by its mode."
  {:following {:icon link-path
               :tooltip "Following the editor. Evaluate an ns or in-ns form to lock to a namespace."
               :label "following the editor"}
   :locked {:icon lock-path
            :tooltip "Locked. Click to follow the editor."
            :label "locked"}
   :selector {:icon lock-path
              :tooltip "Locked to the history entry's namespace. Click to choose."
              :label "locked to the history entry's namespace"}})

(def ^:private choice-looks
  "The icon and the description of the namespace menu's choices, by their mode."
  {:locked {:icon lock-path :detail "from the history"}
   :following {:icon link-path :detail "following the editor"}})

(defn session-label
  "Returns how a choice of the namespace menu shows the session `session-key`, with its `build` after it."
  [session-key build]
  (cond-> session-key
    build (str " · " build)))

(defn- with-sessions
  "Returns the `choices` of the namespace menu with the session that each is in, from `sessions`, when they
   differ."
  [choices sessions]
  (if (apply = sessions)
    choices
    (mapv #(assoc %1 :repl-input.choice/session (apply session-label %2)) choices sessions)))

(defn indicator
  "Returns what the namespace indicator shows for the `context-line` and the `recalled-lock`, the lock of a
   recalled history entry from another context: its mode, `:following`, `:locked`, or `:selector` while the
   recalled entry locks the context, and the namespace. A selector has the choices of its menu: the entry's
   namespace, locked, and the editor's, followed, each with its session when the two differ."
  [{:repl-input.context/keys [ns editor-ns locked? session-key build editor-session-key editor-build]} recalled-lock]
  (cond
    recalled-lock {:repl-input.indicator/mode :selector
                   :repl-input.indicator/ns ns
                   :repl-input.indicator/choices (with-sessions
                                                   [{:repl-input.choice/mode :locked
                                                     :repl-input.choice/ns (:repl-input.context/ns recalled-lock)}
                                                    {:repl-input.choice/mode :following
                                                     :repl-input.choice/ns editor-ns}]
                                                   [[session-key build] [editor-session-key editor-build]])}
    locked? {:repl-input.indicator/mode :locked :repl-input.indicator/ns ns}
    :else {:repl-input.indicator/mode :following :repl-input.indicator/ns ns}))

(defn- prevent-default
  "Keeps the focus where it is when a control is pressed."
  [^js event]
  (.preventDefault event))

(defn- menu-item
  "Returns the item of the namespace menu for the choice `mode`, showing its namespace and session, which
   dispatches `actions` when clicked."
  [mode {:repl-input.choice/keys [ns session]} actions]
  (let [{:keys [icon detail]} (choice-looks mode)]
    [:button {:class "repl-input-menu-item"
              :role "menuitemradio"
              :aria-checked (str (= :locked mode))
              :data-choice (name mode)
              :on {:click actions}}
     (stdin/icon ["repl-input-context-icon"] icon)
     [:span {:class "repl-input-menu-ns"} (or ns "")]
     [:span {:class "repl-input-menu-session"} (or session "")]
     [:span {:class "repl-input-menu-detail"} detail]]))

(defn- focus-index
  "Returns the index of the menu item that the key `pressed` moves the focus to from the item at `index`,
   of `item-count` items, or nil."
  [pressed index item-count]
  (case pressed
    "ArrowDown" (mod (inc index) item-count)
    "ArrowUp" (mod (dec index) item-count)
    "Home" 0
    "End" (dec item-count)
    nil))

(defn- on-menu-keydown
  "Moves the focus between the items of `menu` on the arrow keys, `home` and `end`, and closes it on
   `escape`."
  [^js menu ^js event]
  (let [items (js/Array.from (.querySelectorAll menu ".repl-input-menu-item"))
        pressed (.-key event)]
    (if (= "Escape" pressed)
      (do (.preventDefault event)
          (.hidePopover menu))
      (when-let [index (focus-index pressed (.indexOf items js/document.activeElement) (.-length items))]
        (.preventDefault event)
        (.focus (aget items index))))))

(defn- on-menu-focusout
  "Closes the menu when the focus leaves it."
  [^js event]
  (let [^js menu (.-currentTarget event)]
    (when-not (.contains menu (.-relatedTarget event))
      (.hidePopover menu))))

(defn- on-menu-key
  [^js event]
  (on-menu-keydown (.-currentTarget event) event))

(defn- namespace-menu
  "Returns the menu of the namespace indicator, with the `choices` to keep the lock of the recalled history
   entry, and to follow the editor. Its `toggle` dispatches whether it opened, as `:event/open?`."
  [choices]
  (let [by-mode (into {} (map (juxt :repl-input.choice/mode identity)) choices)]
    [:div {:class "repl-input-menu"
           :popover "auto"
           :role "menu"
           :on {:mousedown prevent-default
                :keydown on-menu-key
                :focusout on-menu-focusout
                :toggle [[:repl-input/ax.namespace-menu-toggled :event/open?]]}}
     (menu-item :locked (by-mode :locked) [[:repl-input/ax.close-namespace-menu]])
     (menu-item :following (by-mode :following) [[:repl-input/ax.follow-editor]
                                                 [:repl-input/ax.close-namespace-menu]])]))

(defn close-menu!
  "Closes the namespace menu."
  []
  (some-> ^js (child "repl-input-menu") .hidePopover))

(defn toggle-menu!
  "Opens the namespace menu under the namespace indicator, with the focus on its first choice, or closes
   it."
  []
  (when-let [^js menu (child "repl-input-menu")]
    (if (.matches menu ":popover-open")
      (.hidePopover menu)
      (do (.showPopover menu #js {:source (child "repl-input-indicator")})
          (some-> (.querySelector menu ".repl-input-menu-item") .focus)))))

(defn- indicator-button
  "Returns the namespace indicator for the `indicator`, hidden until it has a namespace, with a chevron when
   it is a selector, whose menu is open when `menu-open?`."
  [{:repl-input.indicator/keys [mode ns]} menu-open?]
  (let [{:keys [icon tooltip label]} (indicator-looks mode)
        selector? (= :selector mode)]
    (into [:button (merge {:class ["repl-input-context-button" "repl-input-indicator"]
                           :hidden (nil? ns)
                           :on {:mousedown prevent-default
                                :click [[:repl-input/ax.click-namespace-indicator]]}}
                          (tooltip/attributes (if ns tooltip ""))
                          (when ns
                            {:data-mode (name mode)
                             :aria-label (str ns ", " label)})
                          (when (and ns selector?)
                            {:aria-haspopup "menu"
                             :aria-expanded (str (boolean menu-open?))}))]
          (when ns
            (cond-> [(stdin/icon ["repl-input-context-icon"] icon)
                     [:span {:class "repl-input-context-ns"} ns]]
              selector? (conj (stdin/icon ["repl-input-context-icon" "repl-input-indicator-chevron"] chevron-down-path)))))))

(defn row
  "Returns the context line for the `context-line` and the `recalled-lock`, the lock of a recalled history
   entry from another context, as hiccup: the namespace indicator and its menu, a link that connects a REPL
   while no session answers to the line's key, and the play button, disabled while no session answers."
  [{:repl-input.context/keys [connected?] :as context-line} recalled-lock menu-open?]
  (let [{:repl-input.indicator/keys [choices] :as shown} (indicator context-line recalled-lock)]
    [:div {:class "repl-input-context"}
     (indicator-button shown menu-open?)
     (namespace-menu choices)
     [:div {:class "repl-input-context-line"}
      (when-not connected?
        [:span {:class "repl-input-context-connect"
                :role "button"
                :on {:click [[:repl-input/ax.connect]]}}
         "Connect a REPL"])]
     [:button (merge {:class ["repl-input-context-button" "repl-input-evaluate"]
                      :aria-label evaluate-title
                      :aria-disabled (str (not connected?))
                      :on {:mousedown prevent-default
                           :click [[:repl-input/ax.evaluate]]}}
                     (tooltip/attributes (if connected? evaluate-title connect-title)))
      (stdin/icon ["repl-input-context-icon"] play-path)]]))

(defn evaluation-bar
  "Returns the evaluation bar, shown while the `evaluation` is `:running`, as hiccup."
  [evaluation]
  [:div {:class "repl-input-evaluation-bar" :hidden (not= :running evaluation)}
   [:span {:class "repl-input-evaluation-text"} "Evaluating…"]
   [:button {:class "repl-input-interrupt" :on {:click [[:repl-input/ax.interrupt]]}} "Interrupt"]])

(defn close-menu-without-choices!
  "Closes the namespace menu when the `context-line` and the `recalled-lock` give it no choices."
  [context-line recalled-lock]
  (when-not (seq (:repl-input.indicator/choices (indicator context-line recalled-lock)))
    (when-let [^js menu (child "repl-input-menu")]
      (when (.matches menu ":popover-open")
        (.hidePopover menu)))))

(defn controls
  "Returns the REPL Input's parts around its code editor for the controls' `state`, as hiccup: the sash,
   which calls `on-sash-pointerdown` when pressed, the stdin input, the context line and the evaluation bar."
  [{:repl-input/keys [context-line recalled-lock evaluation namespace-menu-open? dragging?]}
   {:keys [mac? on-sash-pointerdown on-stdin-keydown]}]
  (list [:div {:class (cond-> ["repl-input-sash"] mac? (conj "mac") dragging? (conj "active"))
               :on {:pointerdown on-sash-pointerdown}}]
        (stdin/row (= :reading-stdin evaluation) on-stdin-keydown)
        (row context-line recalled-lock namespace-menu-open?)
        (evaluation-bar evaluation)))
