(ns calva.repl.webview.ui
  (:require
   [calva.repl.webview.app-db :as app-db]
   [cljs.reader :as reader]
   [clojure.string :as str]
   ["strip-ansi" :default strip-ansi]
   ["highlightjs-copy" :as CopyButtonPlugin]
   ["highlight.js/lib/core" :as hljs]
   ["highlight.js/lib/languages/clojure" :as clojure]))

;; The DOM element where output is written
(def output-dom-element (js/document.getElementById "output"))

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
  [^js dom-element output]
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
  [^js dom-element output]
  (let [{:keys [code-element container-element]} (clojure-code-element output)]
    (.. dom-element (appendChild container-element))
    (.. hljs (highlightElement code-element))
    (.. dom-element (dispatchEvent (output-appended-event container-element)))))

(defn create-and-append-stdout-element
  "Creates a new stdout element and appends it to the given DOM element."
  [dom-element text-node category]
  (let [pre-element (js/document.createElement "pre")]
    (.. pre-element (appendChild text-node))
    (.. pre-element (setAttribute "data-output-element-type" (or category "evalOut")))
    (.. dom-element (appendChild pre-element))
    (.. dom-element (dispatchEvent (output-appended-event pre-element)))))

(defn append-stdout
  "Appends stdout content to the given DOM element, unless the last element is already a stdout element with the same category,
   in which case it appends the content to that element instead."
  [^js dom-element output category]
  (let [category (or category "evalOut")
        text-node (js/document.createTextNode (strip-ansi output))]
    (if-let [last-output-element (.. dom-element -lastElementChild)]
      (if (= category (.. last-output-element -dataset -outputElementType))
        (do
          (.. last-output-element (appendChild text-node))
          (.. dom-element (dispatchEvent (output-appended-event last-output-element))))
        (create-and-append-stdout-element dom-element text-node category))
      (create-and-append-stdout-element dom-element text-node category))))

(defn session-str
  [{:meta/keys [repl-session-key shadow-build shadow-runtime-id]}]
  (let [parts (cond-> []
                repl-session-key (conj (str repl-session-key))
                shadow-build (conj (str shadow-build))
                (some? shadow-runtime-id) (conj (str shadow-runtime-id)))]
    (str/join " " parts)))

(defn create-ns-info-element
  [{:meta/keys [who ns] :as meta-data}]
  (let [container (js/document.createElement "div")
        sess (session-str meta-data)]
    (.. container -classList (add "ns-info-container"))
    (.. container (setAttribute "data-output-element-type" "ns-info"))
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

(defn append-ns-info
  [^js dom-element meta-data]
  (let [ns-info-el (create-ns-info-element meta-data)]
    (.. dom-element (appendChild ns-info-el))
    (.. dom-element (dispatchEvent (output-appended-event ns-info-el)))))

(defn clear-output-dom
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
  [code-theme]
  (let [code-theme-link-nodes (js/document.querySelectorAll "[data-code-theme]")]
    (.. code-theme-link-nodes (forEach (fn [^js node]
                                         (let [current-code-theme (.. node -dataset -codeTheme)]
                                           (if (= current-code-theme code-theme)
                                             (.. node (removeAttribute "disabled"))
                                             (.. node (setAttribute "disabled" "disabled")))))))
    ;; The timeout seems to prevent an issue where the copy buttons lose some of their styles on theme change.
    (js/setTimeout update-theme-of-copy-buttons 100)))

(defn set-word-wrap!
  [word-wrap]
  (let [body js/document.body]
    (if word-wrap
      (.. body -classList (add "word-wrap"))
      (.. body -classList (remove "word-wrap")))))

(defn set-font-scale!
  [scale]
  (.. js/document -documentElement -style (setProperty "--calva-output-font-scale" (str scale))))

(defn scroll-to
  [{:keys [x y]}]
  (js/scrollTo x y))

(defn exec-effect!
  [^js output-dom-element [fx-type & args]]
  (case fx-type
    :fx/append-ns-info (append-ns-info output-dom-element (first args))
    :fx/append-result (append-eval-result output-dom-element (first args))
    :fx/append-evaluated-code (append-evaluated-code output-dom-element (first args))
    :fx/append-stdout (append-stdout output-dom-element (first args) (second args))
    :fx/clear-dom (clear-output-dom output-dom-element)
    :fx/set-code-theme (set-code-theme! (first args))
    :fx/set-word-wrap (set-word-wrap! (first args))
    :fx/set-font-scale (set-font-scale! (first args))
    :fx/scroll-to (scroll-to (first args))))

(defn dispatch!
  [action]
  (let [current-db @app-db/!app-db
        {:uf/keys [db fxs dxs]} (app-db/handle-action current-db action)]
    (when (and db (not= db current-db))
      (reset! app-db/!app-db db))
    (run! #(exec-effect! output-dom-element %) fxs)
    (run! dispatch! dxs)))

(defn ^:export clear-output-view
  []
  (dispatch! [:msg/clear-output-view]))

(defn handle-message
  [^js message]
  (ensure-dom-content-loaded
   (fn []
     (let [message-data (reader/read-string (.-data message))
           command-name (:command/name message-data)]
       (case command-name
         "clear-output-view"    (dispatch! [:msg/clear-output-view])
         "set-code-theme"       (dispatch! [:msg/set-code-theme message-data])
         "set-word-wrap"        (dispatch! [:msg/set-word-wrap message-data])
         "set-base-font-scale"  (dispatch! [:msg/set-base-font-scale message-data])
         "adjust-font-size"     (dispatch! [:msg/adjust-font-size message-data])
         "reset-font-size"      (dispatch! [:msg/reset-font-size message-data])
         "scroll-to"            (dispatch! [:msg/scroll-to message-data])
         ("show-result" "show-evaluated-code" "show-stdout")
         (dispatch! [:msg/output message-data]))))))

(defn handle-output-appended
  [^js _event]
  (throttled-scroll-to-bottom))

(defn add-event-listeners
  [^js output-dom-element]
  (.. js/window (addEventListener "message" handle-message))
  (.. output-dom-element (addEventListener "output-appended" handle-output-appended)))

(defn ^:export main []
  (add-event-listeners output-dom-element)
  (.. hljs (registerLanguage "clojure" clojure))
  (ensure-dom-content-loaded (fn []
                               (.. hljs (addPlugin (CopyButtonPlugin. #js {:autohide true}))))))
