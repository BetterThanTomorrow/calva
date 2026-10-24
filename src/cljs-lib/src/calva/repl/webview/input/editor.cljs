(ns calva.repl.webview.input.editor
  "The REPL Input's CodeMirror editor, mounted on the Output view's `#repl-input` element."
  (:require
   [calva.repl.webview.input.edit :as edit]
   [calva.repl.webview.input.highlight :as highlight]
   [calva.repl.webview.input.keys :as input-keys]
   ["@codemirror/autocomplete" :refer [closeBrackets closeBracketsKeymap]]
   ["@codemirror/commands" :refer [defaultKeymap history historyKeymap isolateHistory]]
   ["@codemirror/state" :refer [Compartment EditorSelection EditorState Prec StateEffect StateField]]
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
                        :minHeight "var(--repl-input-min-height, auto)"
                        :maxHeight "var(--repl-input-max-height, 40vh)"}
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
                                 #js {:keydown (fn [^js event _view]
                                                 (let [{:keys [cancel? pending-chord?]}
                                                       (input-keys/keydown command-keys @!pending-chord? (keydown-event event))]
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

(defn- extensions
  [dispatch!]
  #js [theme
       highlighting
       bracket-marks
       (.of command-keys-compartment #js [])
       (.of close-brackets-compartment #js [])
       (history)
       (drawSelection)
       (.of keymap (.concat defaultKeymap historyKeymap))
       (.-lineWrapping EditorView)
       (.of (.-cspNonce EditorView) (or (some-> (js/document.querySelector "script[nonce]") .-nonce) ""))
       (.of (.-updateListener EditorView)
            (fn [^js update]
              (when (or (.-docChanged update) (.-selectionSet update))
                (dispatch! [:repl-input/ax.changed (state-payload (.-state update))]))))
       (.domEventHandlers EditorView
                          #js {:focus (fn [_ _] (dispatch! [:repl-input/ax.focused]) false)
                               :blur (fn [_ _] (dispatch! [:repl-input/ax.blurred]) false)})])

(defn- set-height!
  [{:keys [height dragging?]}]
  (let [style (.-style (mount-element))]
    (if height
      (.setProperty style "--repl-input-max-height" (str height "px"))
      (.removeProperty style "--repl-input-max-height"))
    (if dragging?
      (.setProperty style "--repl-input-min-height" (str height "px"))
      (.removeProperty style "--repl-input-min-height"))))

(defn- listen-for-drag!
  [^js handle dispatch!]
  (.addEventListener
   handle "pointerdown"
   (fn [^js down]
     (let [start-y (.-clientY down)
           start-height (some-> (editor-view) .-dom .getBoundingClientRect .-height)
           move (fn [^js e]
                  (dispatch! [:repl-input/ax.drag {:height (+ start-height (- start-y (.-clientY e)))
                                                   :view-height js/window.innerHeight}]))]
       (.preventDefault down)
       (.setPointerCapture handle (.-pointerId down))
       (.addEventListener handle "pointermove" move)
       (.addEventListener handle "pointerup"
                          (fn [_]
                            (.removeEventListener handle "pointermove" move)
                            (dispatch! [:repl-input/ax.drag-ended]))
                          #js {:once true})))))

(defn- mount!
  [dispatch! {:keys [height]}]
  (let [element (mount-element)
        handle (js/document.createElement "div")
        state (.create EditorState #js {:doc "" :extensions (extensions dispatch!)})]
    (set! (.-className handle) "repl-input-resize-handle")
    (.appendChild element handle)
    (listen-for-drag! handle dispatch!)
    (EditorView. #js {:state state :parent element})
    (set-height! {:height height})
    (.. js/document -body -classList (add "repl-input-on"))
    (dispatch! [:repl-input/ax.mounted (state-payload state)])))

(defn- unmount!
  []
  (some-> (editor-view) .destroy)
  (set! (.-textContent (mount-element)) "")
  (.. js/document -body -classList (remove "repl-input-on")))

(defn- set-command-keys!
  [command-keys]
  (when-let [^js view (editor-view)]
    (.dispatch view #js {:effects (.reconfigure command-keys-compartment (command-keys-handler command-keys))})))

(defn- apply-edit!
  [{:keys [text selections]}]
  (when-let [^js view (editor-view)]
    (let [change (edit/text-change (.. view -state -doc toString) text)]
      (.dispatch view (clj->js (cond-> {:selection (.create EditorSelection
                                                            (into-array (for [[anchor head] selections]
                                                                          (.range EditorSelection anchor head))))
                                        :scrollIntoView true
                                        :annotations (.of isolateHistory "full")}
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
    :repl-input/fx.set-bracket-css (set-bracket-css! (first args))))
