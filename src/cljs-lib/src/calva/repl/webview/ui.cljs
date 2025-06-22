(ns calva.repl.webview.ui
  (:require
   [cljs.reader :as reader]
   ["strip-ansi" :default strip-ansi]
   ["highlightjs-copy" :as CopyButtonPlugin]))

;; The DOM element where output is written
(def output-dom-element (js/document.getElementById "output"))

(defonce vscode (js/acquireVsCodeApi))

(defn throttle-fn
  "Returns a throttled version of the function, which will only be called at most once every `wait`
   milliseconds with the arguments passed in the latest call.

   If the throttled function is called again during the wait period, it will not execute until the wait period has
   passed, after which it will only be called once, no matter how many times it was called during the wait.
   If the throttled function is called again after the wait period, it will execute immediately."
  [f wait]
  (let [timeout (atom nil)
        called-during-timeout? (atom false)]
    (fn [& args]
      (if-not @timeout
        (do (apply f args)
            (reset! timeout (js/setTimeout (fn []
                                             (reset! timeout nil)
                                             (when @called-during-timeout?
                                               (reset! called-during-timeout? false)
                                               (apply f args)))
                                           wait)))
        (reset! called-during-timeout? true)))))

(defn scroll-to-bottom
  "Scrolls to the bottom of the the given dom element."
  []
  (js/scrollTo 0 js/document.documentElement.scrollHeight))

;; This can be adjusted if needed to avoid performance issues with too frequent scrolling.
(def throttled-scroll-to-bottom (throttle-fn scroll-to-bottom 0))

(defn output-appended-event
  "Creates a custom event to signal that output has been appended to the output DOM element.
   The event contains the `:container-element` in its detail."
  [container-element]
  (js/CustomEvent. "output-appended" #js {:detail {:container-element container-element}}))

(defn clojure-code-element
  "Creates a code element for Clojure code, with the necessary classes and attributes for syntax highlighting,
   and appends it to a pre element. Returns a map with the `:container-element` and the `:code-element`."
  [clojure-code]
  (let [pre-element (js/document.createElement "pre")
        code-element (js/document.createElement "code")
        text-node (js/document.createTextNode clojure-code)]
    (.. code-element -classList (add "language-clojure"))
    (.. code-element (appendChild text-node))
    (.. pre-element (appendChild code-element))
    {:container-element pre-element
     :code-element code-element}))

(defn append-evaluated-code
  "Appends evaluated code to the given dom element."
  [^js dom-element {:keys [output]}]
  (let [div (js/document.createElement "div")
        span (js/document.createElement "span")
        span-text-node (js/document.createTextNode "Evaluated code")
        {:keys [container-element code-element]} (clojure-code-element output)]
    (.. span -classList (add "border-text"))
    (.. span (appendChild span-text-node))
    (.. div -classList (add "evaluated-code-container"))
    (.. div (appendChild span))
    (.. div (appendChild container-element))
    (.. dom-element (appendChild div))
    (.. js/window -hljs (highlightElement code-element))
    (.. dom-element (dispatchEvent (output-appended-event div)))))

(defn append-eval-result
  [^js dom-element {:keys [output]}]
  (let [{:keys [code-element container-element]} (clojure-code-element output)]
    (.. dom-element (appendChild container-element))
    (.. js/window -hljs (highlightElement code-element))
    (.. dom-element (dispatchEvent (output-appended-event container-element)))))

(defn create-and-append-stdout-element
  "Creates a new stdout element and appends it to the given DOM element."
  [dom-element text-node]
  (let [pre-element (js/document.createElement "pre")]
    (.. pre-element (appendChild text-node))
    (.. pre-element (setAttribute "data-output-element-type" "stdout"))
    (.. dom-element (appendChild pre-element))
    (.. dom-element (dispatchEvent (output-appended-event pre-element)))))

(defn append-stdout
  "Appends stdout content to the given DOM element, unless the last element is already a stdout element,
   in which case it appends the content to that element instead."
  [^js dom-element {:keys [output]}]
  (let [text-node (js/document.createTextNode (strip-ansi output))]
    (if-let [last-output-element (.. dom-element -lastElementChild)]
      (if (= "stdout" (.. last-output-element -dataset -outputElementType))
        (do
          (.. last-output-element (appendChild text-node))
          (.. dom-element (dispatchEvent (output-appended-event last-output-element))))
        (create-and-append-stdout-element dom-element text-node))
      (create-and-append-stdout-element dom-element text-node))))

(defn ^:export clear-output-view
  [^js output-dom-element]
  (set! (.-innerHTML output-dom-element) ""))

(defn update-theme-of-copy-buttons
  []
  (.. (js/document.querySelectorAll "div.hljs-copy-container")
      (forEach (fn [^js copy-container-node]
                 (let [parent-node (.. copy-container-node -parentNode)
                       hljs-code-node (.. parent-node (querySelector "code.hljs"))
                       code-computed-style (js/getComputedStyle hljs-code-node)
                       code-background-color (.-backgroundColor code-computed-style)
                       code-foreground-color (.-color code-computed-style)
                       code-padding (.-padding code-computed-style)]
                   (.. copy-container-node -style (setProperty "--hljs-theme-background" code-background-color))
                   (.. copy-container-node -style (setProperty "--hljs-theme-color" code-foreground-color))
                   (.. copy-container-node -style (setProperty "--hljs-theme-padding" code-padding)))))))

(defn set-code-theme!
  [{:keys [code-theme]}]
  (let [code-theme-link-nodes (js/document.querySelectorAll "[data-code-theme]")]
    (.. code-theme-link-nodes (forEach (fn [^js node]
                                         (let [current-code-theme (.. node -dataset -codeTheme)]
                                           (if (= current-code-theme code-theme)
                                             (.. node (removeAttribute "disabled"))
                                             (.. node (setAttribute "disabled" "disabled")))))))
    ;; The timeout seems to prevent an issue where the copy buttons lose some of their styles on theme change.
    (js/setTimeout update-theme-of-copy-buttons 100)))

(defn scroll-to
  [{:keys [x y]}]
  (js/scrollTo x y))

(defn restore-copy-buttons
  "Re-initializes copy buttons from CopyButtonPlugin (highlightjs-copy - highlight.js plugin) so they they look
   correct and function correctly after the webview HTML is restored from state."
  []
  (.. js/document (querySelectorAll "pre code")
      (forEach (fn [^js element]
                 (js-delete (.. element -dataset) "highlighted")
                 (when-let [copy-container (.. element -parentElement (querySelector ".hljs-copy-container"))]
                   (.. copy-container (remove)))
                 (.. js/window -hljs (highlightElement element))))))

(defn handle-message
  [^js output-dom-element ^js message]
  (let [message-data (reader/read-string (.-data message))
        command-name (:command/name message-data)]
    (case command-name
      "show-result" (append-eval-result output-dom-element message-data)
      "show-evaluated-code" (append-evaluated-code output-dom-element message-data)
      "show-stdout" (append-stdout output-dom-element message-data)
      "clear-output-view" (clear-output-view output-dom-element)
      "set-code-theme" (set-code-theme! message-data)
      "scroll-to" (scroll-to message-data)
      "restore-copy-buttons" (restore-copy-buttons))))

(defn handle-output-appended
  [^js _event]
  (throttled-scroll-to-bottom))

(defn merge-state
  [state]
  (.. vscode (setState (js/Object.assign (or (.. vscode (getState)) #js {})
                                         (clj->js state)))))

(defn save-html
  []
  (merge-state {:html (.. js/document.documentElement -outerHTML)}))

(def throttled-save-html (throttle-fn save-html 1000))

(defn handle-document-mutations
  [_mutation-list, _observer]
  ;; Throttle to avoid performance issues with high volume output.
  (throttled-save-html))

(defn observe-document-mutations
  []
  (doto (js/MutationObserver. handle-document-mutations)
    (.observe js/document.documentElement #js {:childList true
                                               :subtree true
                                               :attributes true
                                               :characterData true})))

(defn save-scroll-state
  []
  (merge-state {:scrollLeft js/document.documentElement.scrollLeft
                :scrollTop js/document.documentElement.scrollTop}))

(def throttled-save-scroll-state (throttle-fn save-scroll-state 200))

(defn add-event-listeners
  [^js output-dom-element]
  (.. js/window (addEventListener "message" (partial handle-message output-dom-element)))
  (.. output-dom-element (addEventListener "output-appended" handle-output-appended))
  (.. js/document (addEventListener "scroll" throttled-save-scroll-state)))

(defn ^:export main []
  (add-event-listeners output-dom-element)
  (observe-document-mutations)
  (.. js/window -hljs (addPlugin (CopyButtonPlugin. #js {:autohide true}))))
