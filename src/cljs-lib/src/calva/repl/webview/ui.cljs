(ns calva.repl.webview.ui
  (:require
   [cljs.reader :as reader]
   ["strip-ansi" :default strip-ansi]))

;; The DOM element where output is written
(def output-dom-element (js/document.getElementById "output"))

(defn throttle-no-arg-fn
  "Returns a throttled version of the given no argument function, which will only be called at most once every `wait`
   milliseconds.

   If the throttled function is called again during the wait period, it will not execute until the wait period has
   passed, after which it will only be called once, no matter how many times it was called during the wait.
   If the throttled function is called again after the wait period, it will execute immediately."
  [f wait]
  (let [timeout (atom nil)
        called-during-timeout? (atom false)]
    (fn []
      (if-not @timeout
        (do (f)
            (reset! timeout (js/setTimeout (fn []
                                             (reset! timeout nil)
                                             (when @called-during-timeout?
                                               (reset! called-during-timeout? false)
                                               (f)))
                                           wait)))
        (reset! called-during-timeout? true)))))

(defn scroll-to-bottom
  "Scrolls to the bottom of the output view."
  []
  (.. output-dom-element (scrollIntoView #js {:behavior "instant" :block "end"})))

;; This can be adjusted if needed to avoid performance issues with too frequent scrolling.
(def throttled-scroll-to-bottom (throttle-no-arg-fn scroll-to-bottom 0))

(defonce state
  (atom {:repl-output/elements []}))

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
  [^js dom-element content]
  (let [div (js/document.createElement "div")
        span (js/document.createElement "span")
        span-text-node (js/document.createTextNode "Evaluated code")
        {:keys [container-element code-element]} (clojure-code-element content)]
    (.. span -classList (add "border-text"))
    (.. span (appendChild span-text-node))
    (.. div -classList (add "evaluated-code-container"))
    (.. div (appendChild span))
    (.. div (appendChild container-element))
    (.. dom-element (appendChild div))
    (.. js/window -hljs (highlightElement code-element))
    (throttled-scroll-to-bottom)))

(defn append-eval-result
  [^js dom-element content]
  (let [{:keys [code-element container-element]} (clojure-code-element content)]
    (.. dom-element (appendChild container-element))
    (.. js/window -hljs (highlightElement code-element))
    (throttled-scroll-to-bottom)))

(defn create-and-append-stdout-element
  "Creates a new stdout element and appends it to the given DOM element."
  [dom-element text-node]
  (let [pre-element (js/document.createElement "pre")]
    (.. pre-element (appendChild text-node))
    (.. pre-element (setAttribute "data-output-element-type" "stdout"))
    (.. dom-element (appendChild pre-element))
    ;; TODO: Move this call to an event listener on the output DOM element. Only scroll if an element is added to the
    ;; _bottom_ of the output, and also throttle the scroll to avoid performance issues.
    ;; OR emit a custom event here like "output-appended"?
    ;; See https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent
    (throttled-scroll-to-bottom)))

(defn append-stdout
  "Appends stdout content to the given DOM element, unless the last element is already a stdout element,
   in which case it appends the content to that element instead."
  [^js dom-element content]
  (let [text-node (js/document.createTextNode (strip-ansi content))]
    (if-let [last-output-element (.. dom-element -lastElementChild)]
      (if (= "stdout" (.. last-output-element -dataset -outputElementType))
        (do
          (.. last-output-element (appendChild text-node))
          (throttled-scroll-to-bottom))
        (create-and-append-stdout-element dom-element text-node))
      (create-and-append-stdout-element dom-element text-node))))

(defn ^:export clear-webview []
  (swap! state assoc :repl-output/elements []))

(defn set-code-theme!
  [theme]
  (let [code-theme-link-nodes (js/document.querySelectorAll "[data-code-theme]")]
    (.. code-theme-link-nodes (forEach (fn [^js node]
                                         (let [code-theme (.. node -dataset -codeTheme)]
                                           (if (= code-theme theme)
                                             (.. node (removeAttribute "disabled"))
                                             (.. node (setAttribute "disabled" "disabled")))))))))

(defn handle-message
  [^js output-dom-element ^js message]
  (let [message-data (reader/read-string (.-data message))
        command-name (:command/name message-data)
        content (:content message-data)]
    (case command-name
      ;; TODO: Separate appending and creation of elements. Then we can just call scroll or emit an output-appended
      ;; event in one place.
      "show-result" (append-eval-result output-dom-element content)
      "show-evaluated-code" (append-evaluated-code output-dom-element content)
      "show-stdout" (append-stdout output-dom-element content)
      "clear-webview" (clear-webview)
      "set-code-theme" (set-code-theme! content))))

(defn add-event-listeners
  [^js output-dom-element]
  (.. js/window
      (addEventListener "message" (partial handle-message output-dom-element))))

(defn ^:export main []
  (add-event-listeners output-dom-element))
