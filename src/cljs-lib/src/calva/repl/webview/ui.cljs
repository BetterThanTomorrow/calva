(ns calva.repl.webview.ui
  (:require

   [replicant.dom :as replicant]))

(def output-dom-element (js/document.getElementById "output"))

(defmulti run-command
  "Runs a given command with the given args."
  (fn [_replicant-data command & _args]
    command))

(defmethod run-command :repl-output/highlight-code
  [_replicant-data _command _args]
  (.. js/window -hljs (highlightAll)))

(defn dispatch
  [replicant-data hook-data]
  (doseq [[command-name & args] hook-data]
    (apply run-command replicant-data command-name args)))

(replicant/set-dispatch! dispatch)

(defn repl-output-element
  [element-data]
  (merge element-data
         {:output-element/id (random-uuid)}))

(defonce state
  (atom {:repl-output/elements
         [(repl-output-element {:output-element/type :output-element.type/eval-result
                                :output-element/content "{:a 1}"})
          (repl-output-element {:output-element/type :output-element.type/stdout
                                :output-element/content "Hello world"})]}))

(defn render-repl-output
  "The watch function for the output elements that renders the output elements."
  [_key _atom _old-state new-state])

(add-watch state :render-repl-output render-repl-output)

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

(defn clojure-code-hiccup
  "Accepts a string of Clojure code and returns hiccup for rendering it in the output view."
  [clojure-code]
  [:pre [:code {:class "language-clojure"} clojure-code]])

(defn repl-output-hiccup
  [state]
  [:div {:replicant/on-render [[:repl-output/highlight-code]]}
   (clojure-code-hiccup "{:a 1}")])

(defn main []
  (.. js/window
      (addEventListener "message"
                        (fn [^js message]
                          (js/console.log "message" message)
                          ;; TODO: Convert message data to CLJ before accessing its properties
                          (let [id (.. message -data -id)
                                command (aget message "data" "command-name")
                                data (.. message -data -result)]
                            (js/console.log "id" id)
                            (js/console.log "command" command)
                            (case command
                              "show-result" (add-eval-result data)
                              "show-stdout" (add-stdout data))))))
  (replicant/render output-dom-element (repl-output-hiccup @state)))
