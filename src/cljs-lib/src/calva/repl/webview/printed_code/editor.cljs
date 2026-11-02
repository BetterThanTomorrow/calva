(ns calva.repl.webview.printed-code.editor
  "The printed code's editor: a read-only CodeMirror editor in place of a printed code block, one at a time,
   with a cursor and selections that Paredit moves, drawn in the block's colors."
  (:require
   [calva.repl.webview.error-element :as error-element]
   [calva.repl.webview.input.commands :as commands]
   [calva.repl.webview.input.editor :as input-editor]
   [calva.repl.webview.input.highlighting :as highlighting]
   [calva.repl.webview.printed-code.folds :as folds]
   ["@codemirror/language" :refer [codeFolding foldGutter foldKeymap foldService]]
   ["@codemirror/state" :refer [Compartment EditorSelection EditorState StateEffect StateField]]
   ["@codemirror/view" :refer [EditorView drawSelection keymap]]))

(defn- text-offset
  "Returns the offset in the text of the `code` element of the DOM position at `offset` in `node`."
  [^js code ^js node offset]
  (let [range (js/document.createRange)]
    (.setStart range code 0)
    (.setEnd range node offset)
    (.. range toString -length)))

(defonce ^:private ^{:doc "The colors each printed code element is drawn with, `{:ranges :marks}`, by the element."}
  !drawn-colors (js/WeakMap.))


(defn clicked-block
  "Returns `{:code :selections :colors}` for a click `event` in a printed code block, with the page's
   selection as offsets in the text of its `code` element, or nil when the selection reaches outside it, as
   a drag across blocks does."
  [^js event]
  (when-let [^js code (some-> ^js (.-target event) (.closest "code.output-code"))]
    (let [selection (js/window.getSelection)
          anchor (.-anchorNode selection)
          focus (.-focusNode selection)]
      (when (and anchor focus (.contains code anchor) (.contains code focus))
        {:code code
         :selections [[(text-offset code anchor (.-anchorOffset selection))
                       (text-offset code focus (.-focusOffset selection))]]
         :colors (.get !drawn-colors code)}))))

(def ^:private theme
  (.theme EditorView
          #js {"&" #js {:color "var(--vscode-editor-foreground)"
                        :backgroundColor "var(--vscode-editor-background)"
                        :fontFamily "var(--vscode-editor-font-family, monospace)"
                        :fontSize "calc(var(--vscode-editor-font-size, 12px) * var(--calva-output-font-scale, 1))"}
               "&.cm-focused" #js {:outline "none"}
               ".cm-scroller" #js {:fontFamily "inherit"
                                   :lineHeight "normal"}
               ".cm-content" #js {:caretColor "var(--vscode-editorCursor-foreground)"
                                  :padding "1em 0"}
               ;; The fold gutter takes the 1em the block has on the left, so the text stays where it was
               ".cm-line" #js {:padding "0 1em 0 0"}
               ".cm-gutters" #js {:backgroundColor "transparent"
                                  :border "none"}
               ".cm-foldGutter .cm-gutterElement" #js {:width "1em"
                                                       :padding "0"
                                                       :display "flex"
                                                       :alignItems "center"
                                                       :justifyContent "center"
                                                       :cursor "pointer"}
               ".printed-code-fold-marker" #js {:display "flex"
                                                :opacity "0"
                                                :transition "opacity 0.1s"}
               ".cm-gutters:hover .printed-code-fold-marker, .printed-code-fold-marker.folded" #js {:opacity "1"}
               ".printed-code-fold-marker svg" #js {:width "0.9em"
                                                    :height "0.9em"
                                                    :fill "var(--vscode-icon-foreground, #c5c5c5)"
                                                    :transition "transform 0.1s ease-out"}
               ".printed-code-fold-marker.open svg" #js {:transform "rotate(90deg)"}
               ".cm-foldPlaceholder" #js {:color "var(--vscode-editor-foldPlaceholderForeground, var(--vscode-descriptionForeground))"
                                          :backgroundColor "transparent"
                                          :border "none"
                                          :margin "0"
                                          :padding "0 1px"}
               ".cm-cursor, .cm-dropCursor" #js {:borderLeftColor "var(--vscode-editorCursor-foreground)"}
               "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground"
               #js {:backgroundColor "var(--vscode-editor-selectionBackground)"}}))

(defonce ^:private set-forms-effect (.define StateEffect))

(def ^:private forms-field
  "The folds of the editor's forms, `[from to]` in the order they open, from the extension's brackets. Text
   too long for those has the fold of its outermost form."
  (.define StateField
           #js {:create (constantly [])
                :update (fn [forms ^js transaction]
                          (reduce (fn [forms ^js effect]
                                    (if (.is effect set-forms-effect) (.-value effect) forms))
                                  forms
                                  (.-effects transaction)))}))

(defn- fold-marker
  "Returns the fold gutter's chevron of a form that is `open?`, or folded."
  [open?]
  (let [marker (js/document.createElement "span")]
    (set! (.-className marker) (str "printed-code-fold-marker " (if open? "open" "folded")))
    (set! (.-innerHTML marker) (str "<svg viewBox=\"0 0 16 16\" aria-hidden=\"true\"><path d=\""
                                    error-element/chevron-path "\"/></svg>"))
    marker))

(def ^:private folding
  #js [forms-field
       (.of foldService (fn [^js state line-start line-end]
                          (when-let [[from to] (folds/fold-at (.field state forms-field) line-start line-end)]
                            #js {:from from :to to})))
       (codeFolding #js {:placeholderText "…"})
       (foldGutter #js {:markerDOM fold-marker
                        ;; A press in the gutter keeps the focus, which would close the editor if it left
                        :domEventHandlers #js {:mousedown (constantly true)}
                        :foldingChanged (fn [^js update]
                                          (not (identical? (.. update -startState (field forms-field))
                                                           (.. update -state (field forms-field)))))})
       (.of keymap foldKeymap)])

(defonce ^:private command-keys-compartment (Compartment.))

(defonce ^:private line-wrapping-compartment (Compartment.))

(defonce ^:private ^{:doc "The editor, `{:view :code}`, with the `code` element it stands in for, or nil."}
  !editor (atom nil))

(defn- editor-selection
  [selections]
  (.create EditorSelection (into-array (for [[anchor head] selections] (.range EditorSelection anchor head)))))

(defn- selections
  [^js state]
  (mapv (fn [^js r] [(.-anchor r) (.-head r)]) (.. state -selection -ranges)))

(defn unmount!
  "Draws the printed code block again in place of the editor, when there is one."
  [dispatch!]
  (when-let [{:keys [^js view ^js code]} @!editor]
    (reset! !editor nil)
    (.. code -style (removeProperty "display"))
    (.destroy view)
    (dispatch! [:printed-code/ax.unmounted])))

(defn- unmount-when-focus-moved-within-page!
  "Draws the block again when the focus left `view` for another place in the page. When the window lost the
   focus, the editor stays, and gets the focus back with the window."
  [dispatch! ^js view]
  (js/setTimeout #(when (and (= view (:view @!editor))
                             (js/document.hasFocus)
                             (not (.-hasFocus view)))
                    (unmount! dispatch!))
                 0))

(defn- extensions
  [dispatch!]
  #js [theme
       ;; Registered first, the bracket marks are the inner spans, so the rainbow colors win over token colors
       input-editor/bracket-marks
       highlighting/field
       (.of (.-readOnly EditorState) true)
       (.of (.-editorAttributes EditorView) #js {:class "printed-code-editor"})
       (.of command-keys-compartment #js [])
       (drawSelection)
       folding
       (.of keymap commands/keymap)
       (.of line-wrapping-compartment (input-editor/line-wrapping (input-editor/output-word-wrap?)))
       (.of (.-cspNonce EditorView) (or (some-> (js/document.querySelector "script[nonce]") .-nonce) ""))
       (.of (.-updateListener EditorView)
            (fn [^js update]
              (when (.-selectionSet update)
                (dispatch! [:printed-code/ax.changed {:selections (selections (.-state update))}]))))
       (.domEventHandlers EditorView
                          #js {:focus (fn [_ ^js view]
                                        (dispatch! [:printed-code/ax.focused {:text (.. view -state -doc toString)
                                                                              :selections (selections (.-state view))}])
                                        false)
                               :blur (fn [_ ^js view]
                                       (dispatch! [:printed-code/ax.blurred])
                                       (unmount-when-focus-moved-within-page! dispatch! view)
                                       false)})])

(defn- set-marks!
  [^js view ranges]
  (.dispatch view #js {:effects (.of input-editor/set-bracket-marks (highlighting/mark-decorations ranges))}))

(defn- mount!
  "Puts an editor with the text of the printed code `code` element, its `selections`, and its `colors`,
   `{:ranges :marks}`, in place of the element, and gives it the focus."
  [dispatch! {:keys [^js code selections colors]}]
  (unmount! dispatch!)
  (let [{:keys [ranges marks]} colors
        state (.create EditorState #js {:doc (.-textContent code)
                                        :selection (editor-selection selections)
                                        :extensions (extensions dispatch!)})
        view (EditorView. #js {:state state})
        code-style (js/getComputedStyle code)]
    ;; The block's padding varies, as between the lines of a result with images
    (set! (.. view -contentDOM -style -paddingTop) (.-paddingTop code-style))
    (set! (.. view -contentDOM -style -paddingBottom) (.-paddingBottom code-style))
    (when-let [fold (when (= "plain" (.getAttribute code "data-highlighted"))
                      (folds/outermost-form (.-textContent code)))]
      (.dispatch view #js {:effects (.of set-forms-effect [fold])}))
    (.after code (.-dom view))
    (.. code -style (setProperty "display" "none"))
    (reset! !editor {:view view :code code})
    (input-editor/listen-for-window-focus!)
    (when (seq ranges)
      (highlighting/set-layer! view :grammar ranges))
    (set-marks! view marks)
    (.focus view)))

(defn drawn!
  "Remembers that the printed `code` element is drawn with `colors`, `{:ranges :marks}`, for its editor to
   start with, and colors the editor standing in for it. The editor's bracket marks come from the extension
   while it is open."
  [^js code {:keys [ranges] :as colors}]
  (.set !drawn-colors code colors)
  (when-let [^js view (when (= code (:code @!editor)) (:view @!editor))]
    (highlighting/set-layer! view :grammar ranges)))

(defn- set-line-wrapping!
  [wrap?]
  (when-let [^js view (:view @!editor)]
    (.dispatch view #js {:effects (.reconfigure line-wrapping-compartment (input-editor/line-wrapping wrap?))})))

(defn- set-selections!
  [selections]
  (when-let [^js view (:view @!editor)]
    (.dispatch view #js {:selection (editor-selection selections)
                         :scrollIntoView true})))

(defn- set-forms!
  "Gives the editor the folds of the forms of its text with the painter's `brackets`, `[from to depth]`."
  [brackets]
  (when-let [^js view (when (seq brackets) (:view @!editor))]
    (let [forms (folds/forms (.. view -state -doc toString) brackets)]
      (when (not= forms (.. view -state (field forms-field)))
        (.dispatch view #js {:effects (.of set-forms-effect forms)})))))

(defn- set-command-keys!
  [command-keys]
  (when-let [^js view (:view @!editor)]
    (.dispatch view #js {:effects (.reconfigure command-keys-compartment
                                                (input-editor/command-keys-handler command-keys))})))

(defn exec-effect!
  [dispatch! [fx-type & args]]
  (case fx-type
    :printed-code/fx.mount (mount! dispatch! (first args))
    :printed-code/fx.unmount (unmount! dispatch!)
    :printed-code/fx.set-selections (set-selections! (first args))
    :printed-code/fx.set-marks (some-> (:view @!editor) (set-marks! (first args)))
    :printed-code/fx.set-forms (set-forms! (first args))
    :printed-code/fx.set-command-keys (set-command-keys! (first args))
    :printed-code/fx.set-line-wrapping (set-line-wrapping! (first args))
    :printed-code/fx.focus (some-> (:view @!editor) input-editor/focus-now-or-later!)))
