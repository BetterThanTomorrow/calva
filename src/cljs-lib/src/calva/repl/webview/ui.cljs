(ns calva.repl.webview.ui
  (:require
   [cljs.reader :as reader]
   ["strip-ansi" :default strip-ansi]))

;; The DOM element where output is written
(def output-dom-element (js/document.getElementById "output"))

(defmulti run-command
  "Runs a given command with the given args."
  (fn [_replicant-data command & _args]
    command))

(defmethod run-command :repl-output/highlight-code
  [{:replicant/keys [node]} _command _args]
  (.. js/window -hljs (highlightElement node)))

(defn dispatch
  "Dispatches commands in hook-data"
  [replicant-data hook-data]
  (doseq [[command-name & args] hook-data]
    (apply run-command replicant-data command-name args)))

(defn repl-output-element
  "Creates a repl output element - adding a unique ID to the :output-element/id attribute."
  [element-data]
  (merge element-data
         {:output-element/id (random-uuid)}))

(defonce state
  (atom {:repl-output/elements []}))

(defn clojure-code-hiccup
  "Accepts a string of Clojure code and returns hiccup for rendering it in the output view."
  [clojure-code]
  [:pre [:code {:class "language-clojure" :replicant/on-render [[:repl-output/highlight-code]]} clojure-code]])

(defn evaluated-code-hiccup
  [element]
  [:div {:class "evaluated-code-container"}
   [:span {:class "border-text"} "Evaluated code"]
   (clojure-code-hiccup (:output-element/content element))])

(defn repl-output-element-hiccup
  "Returns hiccup for rendering a given output element, or nil if the type is unknown."
  [element]
  (condp = (:output-element/type element)
    :output-element.type/eval-result (clojure-code-hiccup (:output-element/content element))
    :output-element.type/evaluated-code (evaluated-code-hiccup element)
    :output-element.type/stdout [:pre (:output-element/content element)]
    nil)) ;; Return nil for unknown types

(defn repl-output-hiccup
  [state]
  (into [:div {:class "output-element-container"}]
        (mapv repl-output-element-hiccup (:repl-output/elements state))))

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

(def throttled-scroll-to-bottom (throttle-no-arg-fn scroll-to-bottom 100))

(defn add-repl-output-element
  [element]
  (swap! state update :repl-output/elements conj element))

(defn add-eval-result
  [content]
  (add-repl-output-element (repl-output-element {:output-element/type :output-element.type/eval-result
                                                 :output-element/content content})))

(defn append-eval-result
  [content]
  (let [pre-element (js/document.createElement "pre")
        code-element (js/document.createElement "code")
        text-node (js/document.createTextNode content)]
    (.. code-element -classList (add "language-clojure"))
    (.. code-element (appendChild text-node))
    (.. pre-element (appendChild code-element))
    (.. output-dom-element (appendChild pre-element))
    (.. js/window -hljs (highlightElement code-element))
    (throttled-scroll-to-bottom)))

(defn add-evaluated-code
  [content]
  (add-repl-output-element (repl-output-element {:output-element/type :output-element.type/evaluated-code
                                                 :output-element/content content})))

(defn add-stdout
  [content]
  (let [repl-output-elements (:repl-output/elements @state)
        last-output-element-type (-> repl-output-elements last :output-element/type)]
    ;; If the last output element is also stdout, append to it instead of creating a new one
    (if (= last-output-element-type :output-element.type/stdout)
      (swap! state update-in [:repl-output/elements (dec (count repl-output-elements)) :output-element/content]
             str (strip-ansi content))
      (add-repl-output-element (repl-output-element {:output-element/type :output-element.type/stdout
                                                     :output-element/content (strip-ansi content)})))))

(defn append-stdout
  "Appends stdout content to the given DOM element."
  [dom-element content]
  ;; TODO: Check if last element is a pre element, and if so, append to its text node
  (let [pre-element (js/document.createElement "pre")
        text-node (js/document.createTextNode content)]
    (.. pre-element (appendChild text-node))
    (.. dom-element (appendChild pre-element))
    ;; TODO: Move this call to an event listener on the output DOM element. Only scroll if an element is added to the
    ;; _bottom_ of the output, and also throttle the scroll to avoid performance issues.
    ;; OR emit a custom event here like "output-appended"?
    (throttled-scroll-to-bottom)))

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
      "show-result" (append-eval-result content)
      "show-evaluated-code" (add-evaluated-code content)
      "show-stdout" (append-stdout output-dom-element content)
      "clear-webview" (clear-webview)
      "set-code-theme" (set-code-theme! content))))

(defn add-event-listeners
  [^js output-dom-element]
  (.. js/window
      (addEventListener "message" (partial handle-message output-dom-element))))

(defn ^:export main []
  (add-event-listeners output-dom-element))

(comment
  (with-out-str
    (time (do
            (def pre-element (js/document.createElement "pre"))
            (.. output-dom-element (appendChild pre-element))
            (doseq [x (range 5000)]
              (.. pre-element (appendChild (js/document.createTextNode (str "\n" x))))
              (scroll-to-bottom)))))
  ;;=> "\"Elapsed time: 12031.800000 msecs\"\n"

  :rcf)
