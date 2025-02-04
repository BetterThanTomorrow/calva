(ns calva.repl.webview.ui
  (:require
   [replicant.dom :as replicant]
   [clojure.string :as str]))

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
  (atom {:repl-output/elements
         ;; TODO: Create schemas for these elements
         [#_(repl-output-element {:output-element/type :output-element.type/eval-result
                                  :output-element/content "{:a 1}"})
          #_(repl-output-element {:output-element/type :output-element.type/stdout
                                  :output-element/content "hello world"})]}))

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

(comment
  (str/split-lines "hello\n\nworld")
  :rcf)

(defn repl-output-hiccup
  [state]
  ;; TODO: Don't run highlightAll on every render of the top-level div.
  ;; Instead, run it on each code block as it's added.
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

(defn save-state
  [_key _atom _old-state new-state]
  (.. vs-code-api (saveState new-state)))

;; TODO: Use this map to add watches to the state atom
(def state-watchers
  {#_#_:save-state save-state
   :render-repl-output render-repl-output
   :scroll-to-bottom scroll-to-bottom})

(defn add-state-watchers! []
  (run! (fn [[key f]]
          (add-watch state key f))
        state-watchers))

;; TODO: Finish this to add all watchers
;; (run! (fn [[]]) state-watchers)

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

(defn main []
  (add-state-watchers!)
  (.. js/window
      (addEventListener "message"
                        (fn [^js message]
                          ;; TODO: Convert message data to CLJ before accessing its properties
                          (let [_id (.. message -data -id)
                                command (aget message "data" "command-name")
                                content (.. message -data -content)]
                            (case command
                              "show-result" (add-eval-result content)
                              "show-stdout" (add-stdout content))))))
  ;; TODO: Persist state and reload it when webview is created so that the webview content persists
  ;; in the UI when the webview is hidden then focused again
  ;; https://code.visualstudio.com/api/extension-guides/webview#persistence
  (render @state))

(comment
  (.. vs-code-api (setState @state))
  (.. vs-code-api (getState))
  (js/acquireVsCodeApi)
  :rcf)
