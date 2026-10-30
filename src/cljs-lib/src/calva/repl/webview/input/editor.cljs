(ns calva.repl.webview.input.editor
  "The REPL Input's CodeMirror editor, mounted on the Output view's `#repl-input` element, and the controls
   around it, rendered there with Replicant."
  (:require
   [calva.repl.webview.input.commands :as commands]
   [calva.repl.webview.input.completion :as completion]
   [calva.repl.webview.input.context :as context]
   [calva.repl.webview.input.definition :as definition]
   [calva.repl.webview.input.edit :as edit]
   [calva.repl.webview.input.highlight :as highlight]
   [calva.repl.webview.input.history :as input-history]
   [calva.repl.webview.input.keys :as input-keys]
   [calva.repl.webview.input.stdin :as stdin]
   [calva.repl.webview.tooltip :as tooltip]
   [replicant.dom :as replicant]
   ["@codemirror/autocomplete" :refer [closeBrackets closeBracketsKeymap]]
   ["@codemirror/commands" :refer [history isolateHistory]]
   ["@codemirror/state" :refer [Compartment EditorSelection EditorState Prec StateEffect StateField Transaction]]
   ["@codemirror/view" :refer [Decoration EditorView drawSelection keymap]]))

(defn mount-element
  []
  (js/document.getElementById "repl-input"))

(defn- editor-view
  []
  (when-let [dom (some-> (mount-element) (.querySelector ".cm-editor"))]
    (.findFromDOM EditorView dom)))

(defn- mark-decorations
  [ranges]
  (.set Decoration
        (into-array (for [[from to class-name] ranges]
                      (.range (.mark Decoration #js {:class class-name}) from to)))
        true))

(def highlighting
  (.define StateField
           #js {:create (fn [^js state] (mark-decorations (highlight/highlight-ranges (.. state -doc toString))))
                :update (fn [decorations ^js transaction]
                          (if (.-docChanged transaction)
                            (mark-decorations (highlight/highlight-ranges (.. transaction -state -doc toString)))
                            decorations))
                :provide (fn [field] (.from (.-decorations EditorView) field))}))

(def ^:private set-bracket-marks (.define StateEffect))

(def ^:private bracket-marks
  (.define StateField
           #js {:create (fn [_] (.-none Decoration))
                :update (fn [^js decorations ^js transaction]
                          (reduce (fn [decorations ^js effect]
                                    (if (.is effect set-bracket-marks) (.-value effect) decorations))
                                  (.map decorations (.-changes transaction))
                                  (.-effects transaction)))
                :provide (fn [field] (.from (.-decorations EditorView) field))}))

(def theme
  (.theme EditorView
          #js {"&" #js {:color "var(--vscode-input-foreground)"
                        :backgroundColor "var(--vscode-input-background)"
                        :border "1px solid var(--vscode-input-border, transparent)"
                        :fontFamily "var(--vscode-editor-font-family, monospace)"
                        :fontSize "calc(var(--vscode-editor-font-size, 12px) * var(--calva-output-font-scale, 1))"
                        :height "var(--repl-input-height, auto)"
                        ;; Two lines at the scroller's 1.4 line height, the content's 4px padding above and below, and the border
                        :minHeight "var(--repl-input-height, calc(2.8em + 10px))"
                        :maxHeight "var(--repl-input-height, 40vh)"}
               "&.cm-focused" #js {:outline "1px solid var(--vscode-focusBorder)"}
               ".cm-scroller" #js {:fontFamily "inherit"
                                   :overflow "auto"}
               ".cm-content" #js {:caretColor "var(--vscode-editorCursor-foreground)"
                                  :padding "4px 0"}
               ".cm-cursor, .cm-dropCursor" #js {:borderLeftColor "var(--vscode-editorCursor-foreground)"}
               "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground"
               #js {:backgroundColor "var(--vscode-editor-selectionBackground)"}}))

(defn- selections
  [^js state]
  (mapv (fn [^js r] [(.-anchor r) (.-head r)]) (.. state -selection -ranges)))

(defn- state-payload
  [^js state]
  {:text (.. state -doc toString)
   :selections (selections state)})

(defonce ^:private command-keys-compartment (Compartment.))

(defn- keydown-event
  [^js event]
  {:key (.-key event)
   :code (.-code event)
   :ctrl? (.-ctrlKey event)
   :shift? (.-shiftKey event)
   :alt? (.-altKey event)
   :meta? (.-metaKey event)
   :composing? (.-isComposing event)})

(defn- command-keys-handler
  "Leaves the `command-keys` to VS Code, before CodeMirror's keymap sees them."
  [command-keys]
  (let [!pending-chord? (volatile! false)]
    (.highest Prec
              (.domEventHandlers EditorView
                                 #js {:keydown (fn [^js event ^js view]
                                                 (let [{:keys [cancel? pending-chord?]}
                                                       (input-keys/keydown command-keys
                                                                           @!pending-chord?
                                                                           (assoc (keydown-event event)
                                                                                  :completion-list? (completion/open? (.-state view))))]
                                                   (vreset! !pending-chord? pending-chord?)
                                                   (when cancel?
                                                     (.preventDefault event))
                                                   cancel?))}))))

(defonce ^:private close-brackets-compartment (Compartment.))

(def ^:private quotes-in-strings
  "Types a quote inside a string as Clojure files do: alone, or over the quote that closes the string."
  (.high Prec
         (.of (.-inputHandler EditorView)
              (fn [^js view from to text]
                (when (and (= "\"" text) (= from to))
                  (when-let [typed (highlight/typed-quote (.. view -state -doc toString) from)]
                    (.dispatch view (if (= :step-over typed)
                                      #js {:selection #js {:anchor (inc from)}}
                                      #js {:changes #js {:from from :insert text}
                                           :selection #js {:anchor (inc from)}
                                           :userEvent "input.type"}))
                    true))))))

(defn- close-brackets-extension
  "Closes the `brackets` as they are typed, and skips over a closing bracket it inserted."
  [brackets]
  (if (seq brackets)
    #js [quotes-in-strings
         (closeBrackets)
         (.of keymap closeBracketsKeymap)
         (.of (.-languageData EditorState)
              (fn [_ _ _] #js [#js {:closeBrackets #js {:brackets (clj->js brackets)}}]))]
    #js []))

(defonce ^:private editing-compartment (Compartment.))

(def ^:private mac? (boolean (re-find #"Mac" js/navigator.platform)))

(defn- editing-extension
  "Adds a cursor on click with the `multi-cursor-modifier` of `editor.multiCursorModifier`, goes to the
   definition on click with the other modifier, and reads words by the `word-separators` of
   `editor.wordSeparators`."
  [dispatch! {:keys [multi-cursor-modifier word-separators]}]
  #js [(.of (.-clickAddsSelectionRange EditorView)
            (if (= "ctrlCmd" multi-cursor-modifier)
              (fn [^js event] (if mac? (.-metaKey event) (.-ctrlKey event)))
              (fn [^js event] (.-altKey event))))
       (definition/click-extension dispatch! {:multi-cursor-modifier multi-cursor-modifier :mac? mac?})
       (commands/language-data word-separators)])

(defonce ^:private completion-compartment (Compartment.))

(defn- walk-key
  [^js state k]
  (let [doc (.-doc state)
        selection (.-selection state)]
    {:key k
     :cursors (.. selection -ranges -length)
     :cursor-line (.-number (.lineAt doc (.. selection -main -head)))
     :line-count (.-lines doc)
     :completion-open? (completion/open? state)}))

(defn- history-keymap
  "Walks the history with `up` on the first line and `down` on the last line."
  [dispatch!]
  (.high Prec
         (.of keymap
              (clj->js (for [[key-name k] [["ArrowUp" :up] ["ArrowDown" :down]]]
                         {:key key-name
                          :run (fn [^js view]
                                 (if-let [direction (input-history/walk-direction (walk-key (.-state view) k))]
                                   (do (dispatch! [:repl-input/ax.walk-history direction])
                                       true)
                                   false))})))))

(defonce ^:private line-wrapping-compartment (Compartment.))

(defn- line-wrapping
  "Wraps the lines when `wrap?`."
  [wrap?]
  (if wrap? (.-lineWrapping EditorView) #js []))

(defn- output-word-wrap?
  "True while the Output view wraps its output."
  []
  (.. js/document -body -classList (contains "word-wrap")))

(defn- extensions
  [dispatch!]
  #js [theme
       highlighting
       bracket-marks
       (.of command-keys-compartment #js [])
       (.of close-brackets-compartment #js [])
       (.of editing-compartment #js [])
       (.of completion-compartment #js [])
       (history)
       commands/extensions
       (drawSelection)
       (history-keymap dispatch!)
       (.of keymap commands/keymap)
       (.of line-wrapping-compartment (line-wrapping (output-word-wrap?)))
       (.of (.-cspNonce EditorView) (or (some-> (js/document.querySelector "script[nonce]") .-nonce) ""))
       (.of (.-updateListener EditorView)
            (fn [^js update]
              (when (or (.-docChanged update) (.-selectionSet update))
                (dispatch! [:repl-input/ax.changed (state-payload (.-state update))]))
              (dispatch! [:repl-input/ax.completion-active (completion/open? (.-state update))])))
       (.domEventHandlers EditorView
                          #js {:focus (fn [_ _] (dispatch! [:repl-input/ax.focused]) false)
                               :blur (fn [_ _] (dispatch! [:repl-input/ax.blurred]) false)})])

(defn- set-height!
  "Keeps the REPL Input at `height`, or lets it grow with its text when there is no `height`."
  [height]
  (let [style (.-style (mount-element))]
    (if height
      (.setProperty style "--repl-input-height" (str height "px"))
      (.removeProperty style "--repl-input-height"))))

(defn- empty-height
  "Returns the height in px of `view` with two empty lines, as the theme's `minHeight` has it."
  [^js view]
  (let [px js/parseFloat
        line-height (px (.-lineHeight (js/getComputedStyle (.-scrollDOM view))))
        ^js content (js/getComputedStyle (.-contentDOM view))
        ^js editor (js/getComputedStyle (.-dom view))]
    (+ (* 2 line-height)
       (px (.-paddingTop content)) (px (.-paddingBottom content))
       (px (.-borderTopWidth editor)) (px (.-borderBottomWidth editor)))))

(defn- start-drag!
  "Follows the pointer that pressed the sash, the target of `down`, and dispatches the REPL Input's height
   as it moves."
  [dispatch! ^js down]
  (let [^js sash (.-currentTarget down)
        ^js view (editor-view)
        start-y (.-clientY down)
        start-height (.. view -dom getBoundingClientRect -height)
        min-height (empty-height view)
        move (fn [^js e]
               (dispatch! [:repl-input/ax.drag {:height (+ start-height (- start-y (.-clientY e)))
                                                :min-height min-height
                                                :view-height js/window.innerHeight}]))]
    (.preventDefault down)
    (.setPointerCapture sash (.-pointerId down))
    (dispatch! [:repl-input/ax.drag-started])
    (.addEventListener sash "pointermove" move)
    (.addEventListener sash "pointerup"
                       (fn [_]
                         (.removeEventListener sash "pointermove" move)
                         (dispatch! [:repl-input/ax.drag-ended]))
                       #js {:once true})))

(defonce ^:private !window-focus (atom {:listening? false :last-focused nil :pointer-down-at 0}))

(defn- in-repl-input?
  [^js element]
  (boolean (some-> (mount-element) (.contains element))))

(defn- remember-focus!
  [^js event]
  (swap! !window-focus assoc :last-focused (when (in-repl-input? (.-target event)) (.-target event))))

(defn- forget-focus-moved-within-page!
  "Forgets the REPL Input's element when the focus left it for another place in the page. When the window
   lost the focus, the element is kept, since the window gets the focus back without it."
  [^js event]
  (when (in-repl-input? (.-target event))
    (js/setTimeout #(when (and (js/document.hasFocus)
                               (not (in-repl-input? js/document.activeElement)))
                      (swap! !window-focus assoc :last-focused nil))
                   0)))

(defn- restore-focus!
  "Gives the focus back to the REPL Input's element that had it before the window lost the focus. After
   the command palette closes, VS Code focuses the view, and the page's body gets the focus. A pointer press
   focuses the window too, and then the press decides where the focus goes."
  []
  (let [{:keys [^js last-focused pointer-down-at]} @!window-focus]
    (when (and last-focused
               (.-isConnected last-focused)
               (< 500 (- (js/performance.now) pointer-down-at))
               (contains? #{nil js/document.body} js/document.activeElement))
      (.focus last-focused))))

(defn- listen-for-window-focus!
  []
  (when-not (:listening? @!window-focus)
    (swap! !window-focus assoc :listening? true)
    (js/window.addEventListener "pointerdown" #(swap! !window-focus assoc :pointer-down-at (js/performance.now)) true)
    (js/document.addEventListener "focusin" remember-focus!)
    (js/document.addEventListener "focusout" forget-focus-moved-within-page!)
    (js/window.addEventListener "focus" restore-focus!)))

(defonce ^:private !controls
  (atom {:handlers nil :state nil}))

(defn- render-controls!
  "Renders the REPL Input's controls for their `state` around CodeMirror's element, which comes after them,
   and which Replicant leaves alone."
  [state]
  (swap! !controls assoc :state state)
  (when-let [element (mount-element)]
    (replicant/render element (context/controls state (:handlers @!controls)))
    (context/close-menu-without-choices! (:repl-input/context-line state) (:repl-input/recalled-lock state))
    (tooltip/refresh!)))

(defn ^:dev/after-load render-reloaded-controls!
  "Renders the REPL Input's controls again after a code reload, in development."
  []
  (let [{:keys [handlers state]} @!controls]
    (when (and handlers (some-> (mount-element) .-firstElementChild))
      (render-controls! state))))

(defn- event-value
  "Returns what the placeholder `x` in an action stands for in the DOM `event`, or `x`."
  [^js event x]
  (case x
    :event/open? (= "open" (.-newState event))
    x))

(defn- mount!
  [dispatch! {:keys [height controls]}]
  (let [element (mount-element)
        state (.create EditorState #js {:doc "" :extensions (extensions dispatch!)})]
    (replicant/set-dispatch! (fn [{:replicant/keys [^js dom-event]} actions]
                               (when (= "click" (.-type dom-event))
                                 (tooltip/hide!))
                               (run! #(dispatch! (mapv (partial event-value dom-event) %)) actions)))
    (swap! !controls assoc :handlers {:mac? mac?
                                      :on-sash-pointerdown (partial start-drag! dispatch!)
                                      :on-stdin-keydown (partial stdin/on-keydown dispatch!)})
    (render-controls! controls)
    (listen-for-window-focus!)
    (EditorView. #js {:state state :parent element})
    (set-height! height)
    (.. js/document -body -classList (add "repl-input-on"))
    (dispatch! [:repl-input/ax.mounted (state-payload state)])))

(defn- unmount!
  []
  (some-> (editor-view) .destroy)
  (some-> (mount-element) replicant/unmount)
  (set! (.-textContent (mount-element)) "")
  (.. js/document -body -classList (remove "repl-input-on")))

(defn- set-command-keys!
  [command-keys]
  (when-let [^js view (editor-view)]
    (.dispatch view #js {:effects (.reconfigure command-keys-compartment (command-keys-handler command-keys))})))

(defn- apply-edit!
  [{:keys [text selections restore?]}]
  (when-let [^js view (editor-view)]
    (let [change (edit/text-change (.. view -state -doc toString) text)]
      (.dispatch view (clj->js (cond-> {:selection (.create EditorSelection
                                                            (into-array (for [[anchor head] selections]
                                                                          (.range EditorSelection anchor head))))
                                        :scrollIntoView true
                                        :annotations (if restore?
                                                       (.of (.-addToHistory Transaction) false)
                                                       (.of isolateHistory "full"))}
                                 change (assoc :changes change)))))))

(defn- set-bracket-marks!
  [ranges]
  (when-let [^js view (editor-view)]
    (.dispatch view #js {:effects (.of set-bracket-marks (mark-decorations ranges))})))

(defn- set-close-brackets!
  [brackets]
  (when-let [^js view (editor-view)]
    (.dispatch view #js {:effects (.reconfigure close-brackets-compartment (close-brackets-extension brackets))})))

(defonce ^:private !bracket-sheet (atom nil))

(defn- set-bracket-css!
  [css]
  (let [^js sheet (or @!bracket-sheet
                      (let [sheet (js/CSSStyleSheet.)]
                        (set! (.-adoptedStyleSheets js/document) (.concat (.-adoptedStyleSheets js/document) #js [sheet]))
                        (reset! !bracket-sheet sheet)))]
    (.replaceSync sheet css)))

(defn- set-line-wrapping!
  [wrap?]
  (when-let [^js view (editor-view)]
    (.dispatch view #js {:effects (.reconfigure line-wrapping-compartment (line-wrapping wrap?))})))

(defn- set-editing!
  [dispatch! settings]
  (when-let [^js view (editor-view)]
    (.dispatch view #js {:effects (.reconfigure editing-compartment (editing-extension dispatch! settings))})))

(defn- run-command!
  [command-name]
  (when-let [^js view (editor-view)]
    (when-let [command (get commands/by-name command-name)]
      (command view))))

(defn- focus-now-or-later!
  "Focuses `target` now, or when the view gets the focus, since revealing the view gives it the focus
   after the extension asks."
  [^js target]
  (if (js/document.hasFocus)
    (.focus target)
    (js/window.addEventListener "focus" #(.focus target) #js {:once true})))

(defn- focus!
  []
  (some-> (editor-view) focus-now-or-later!))

(defn- hide-stdin!
  "Empties the stdin input, and gives the focus back to the REPL Input when the stdin input had it."
  []
  (let [had-focus? (stdin/focused?)]
    (stdin/clear!)
    (when had-focus?
      (focus!))))

(defn- set-completion!
  [dispatch! config]
  (when-let [^js view (editor-view)]
    (.dispatch view #js {:effects (.reconfigure completion-compartment (completion/extension dispatch! config))})))

(defn exec-effect!
  [dispatch! [fx-type & args]]
  (case fx-type
    :repl-input/fx.mount (mount! dispatch! (first args))
    :repl-input/fx.unmount (unmount!)
    :repl-input/fx.set-height (set-height! (first args))
    :repl-input/fx.set-command-keys (set-command-keys! (first args))
    :repl-input/fx.apply-edit (apply-edit! (first args))
    :repl-input/fx.set-brackets (set-bracket-marks! (first args))
    :repl-input/fx.set-close-brackets (set-close-brackets! (first args))
    :repl-input/fx.set-bracket-css (set-bracket-css! (first args))
    :repl-input/fx.set-editing (set-editing! dispatch! (first args))
    :repl-input/fx.set-line-wrapping (set-line-wrapping! (first args))
    :repl-input/fx.run-command (run-command! (first args))
    :repl-input/fx.render-controls (render-controls! (first args))
    :repl-input/fx.toggle-namespace-menu (context/toggle-menu!)
    :repl-input/fx.close-namespace-menu (context/close-menu!)
    :repl-input/fx.show-stdin (some-> (stdin/clear!) focus-now-or-later!)
    :repl-input/fx.hide-stdin (hide-stdin!)
    :repl-input/fx.focus (focus!)
    :repl-input/fx.forget-focus (swap! !window-focus assoc :last-focused nil)
    :repl-input/fx.focus-stdin (some-> (stdin/input-element) focus-now-or-later!)
    :repl-input/fx.set-completion (set-completion! dispatch! (first args))
    :repl-input/fx.deliver-completions (completion/deliver! (editor-view) dispatch! (first args))
    :repl-input/fx.deliver-completion-docs (completion/deliver-docs! (first args))))
