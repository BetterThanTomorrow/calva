(ns calva.repl.webview.ui
  (:require
   [cljs.reader :as reader]
   [clojure.string :as str]
   ["strip-ansi" :default strip-ansi]
   ["highlightjs-copy" :as CopyButtonPlugin]
   ["highlight.js/lib/core" :as hljs]
   ["highlight.js/lib/languages/clojure" :as clojure]))

;; The DOM element where output is written
(def output-dom-element (js/document.getElementById "output"))

(defonce last-context (atom nil))

(defn ensure-dom-content-loaded
  "Ensures the DOM is ready before executing the callback"
  [callback]
  (if (= "complete" js/document.readyState)
    (callback)
    (js/document.addEventListener "DOMContentLoaded" callback #js {:once true})))

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
    (.. hljs (highlightElement code-element))
    (.. dom-element (dispatchEvent (output-appended-event div)))))

(defn append-eval-result
  [^js dom-element {:keys [output]}]
  (let [{:keys [code-element container-element]} (clojure-code-element output)]
    (.. dom-element (appendChild container-element))
    (.. hljs (highlightElement code-element))
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

(defn session-str
  [{:keys [repl-session-key shadow-build shadow-runtime-id]}]
  (let [parts (cond-> []
                repl-session-key (conj (str repl-session-key))
                shadow-build (conj (str shadow-build))
                (some? shadow-runtime-id) (conj (str shadow-runtime-id)))]
    (str/join " " parts)))

(defn create-ns-info-element
  [{:keys [who ns] :as meta-data}]
  (let [container (js/document.createElement "div")
        prefix (js/document.createElement "span")
        sess (session-str meta-data)]
    (.. container -classList (add "ns-info-container"))
    (.. container (setAttribute "data-output-element-type" "ns-info"))
    (.. prefix -classList (add "ns-info-prefix"))
    (.. prefix (appendChild (js/document.createTextNode ";")))
    (.. container (appendChild prefix))
    (when (and who (not= who "ui"))
      (let [who-badge (js/document.createElement "span")]
        (.. who-badge -classList (add "ns-info-badge" "ns-info-who"))
        (.. who-badge (appendChild (js/document.createTextNode who)))
        (.. container (appendChild who-badge))))
    (when (seq sess)
      (let [sess-badge (js/document.createElement "span")]
        (.. sess-badge -classList (add "ns-info-badge" "ns-info-session"))
        (.. sess-badge (appendChild (js/document.createTextNode sess)))
        (.. container (appendChild sess-badge))))
    (when ns
      (let [ns-badge (js/document.createElement "span")]
        (.. ns-badge -classList (add "ns-info-badge" "ns-info-ns"))
        (.. ns-badge (appendChild (js/document.createTextNode ns)))
        (.. container (appendChild ns-badge))))
    container))

(defn maybe-append-ns-info
  [^js dom-element {:keys [meta]}]
  (when-let [ns (:ns meta)]
    (let [context-key [(:who meta) (:repl-session-key meta) (:shadow-build meta) (:shadow-runtime-id meta) ns]]
      (when (not= context-key @last-context)
        (reset! last-context context-key)
        (let [ns-info-el (create-ns-info-element meta)]
          (.. dom-element (appendChild ns-info-el))
          (.. dom-element (dispatchEvent (output-appended-event ns-info-el))))))))

(defn ^:export clear-output-view
  [^js output-dom-element]
  (reset! last-context nil)
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

(defn set-word-wrap!
  [{:keys [word-wrap]}]
  (let [body js/document.body]
    (if word-wrap
      (.. body -classList (add "word-wrap"))
      (.. body -classList (remove "word-wrap")))))

(defn scroll-to
  [{:keys [x y]}]
  (js/scrollTo x y))

(defn handle-message
  [^js output-dom-element ^js message]
  (ensure-dom-content-loaded
   (fn []
     (let [message-data (reader/read-string (.-data message))
           command-name (:command/name message-data)]
       (case command-name
         "show-result" (do
                         (maybe-append-ns-info output-dom-element message-data)
                         (append-eval-result output-dom-element message-data))
         "show-evaluated-code" (do
                                 (maybe-append-ns-info output-dom-element message-data)
                                 (append-evaluated-code output-dom-element message-data))
         "show-stdout" (do
                         (maybe-append-ns-info output-dom-element message-data)
                         (append-stdout output-dom-element message-data))
         "clear-output-view" (clear-output-view output-dom-element)
         "set-code-theme" (set-code-theme! message-data)
         "set-word-wrap" (set-word-wrap! message-data)
         "scroll-to" (scroll-to message-data))))))

(defn handle-output-appended
  [^js _event]
  (throttled-scroll-to-bottom))

(defn add-event-listeners
  [^js output-dom-element]
  (.. js/window (addEventListener "message" (partial handle-message output-dom-element)))
  (.. output-dom-element (addEventListener "output-appended" handle-output-appended)))

(defn ^:export main []
  (add-event-listeners output-dom-element)
  (.. hljs (registerLanguage "clojure" clojure))
  (ensure-dom-content-loaded (fn []
                               (.. hljs (addPlugin (CopyButtonPlugin. #js {:autohide true}))))))
