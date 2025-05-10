(ns calva.repl.webview.ui
  (:require
   [replicant.dom :as replicant]
   [clojure.string :as str]
   [cljs.reader :as reader]))

;; The DOM element where output is written
(def output-dom-element (js/document.getElementById "output"))

;; See here for a description of this function: https://code.visualstudio.com/api/extension-guides/webview#passing-messages-from-a-webview-to-an-extension
(defonce vs-code-api (js/acquireVsCodeApi))

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

(replicant/set-dispatch! dispatch)

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

(defmulti repl-output-element-hiccup
  "Returns hiccup for rendering a given output element."
  :output-element/type)

(defmethod repl-output-element-hiccup :output-element.type/eval-result
  [element]
  (clojure-code-hiccup (:output-element/content element)))

(defmethod repl-output-element-hiccup :output-element.type/stdout
  [element]
  (let [content (:output-element/content element)
        lines (str/split-lines content)]
    (into [:p] (map (fn [line] [:span line [:br]]) lines))))

(defn repl-output-hiccup
  [state]
  (into [:div]
        (map repl-output-element-hiccup (:repl-output/elements state))))

(defn render [state]
  (replicant/render output-dom-element (repl-output-hiccup state)))

(defn render-repl-output
  "The watch function for the output elements that renders the output elements."
  [_key _atom _old-state new-state]
  (render new-state))

(defn scroll-to-bottom
  "Scrolls to the bottom of the output view."
  [_key _atom _old-state _new-state]
  (.. output-dom-element (scrollIntoView #js {:behavior "instant" :block "end"})))

(def state-watchers
  {:render-repl-output render-repl-output
   :scroll-to-bottom scroll-to-bottom})

(run! (fn [[key f]]
        (add-watch state key f))
      state-watchers)

(defn add-repl-output-element
  [element]
  (swap! state update :repl-output/elements conj element))

(defn add-eval-result
  [content]
  (add-repl-output-element (repl-output-element {:output-element/type :output-element.type/eval-result
                                                 :output-element/content content})))

(defn add-stdout
  [content]
  (add-repl-output-element (repl-output-element {:output-element/type :output-element.type/stdout
                                                 :output-element/content content})))

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
  [^js message]
  (let [message-data (reader/read-string (.-data message))
        command-name (:command/name message-data)
        content (:content message-data)]
    (case command-name
      "show-result" (add-eval-result content)
      "show-stdout" (add-stdout content)
      "clear-webview" (clear-webview)
      "set-code-theme" (set-code-theme! content))))

(defn add-event-listeners []
  (.. js/window
      (addEventListener "message" handle-message)))

(defn ^:export main []
  (add-event-listeners)
  (render @state))
