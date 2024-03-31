(ns calva.repl.webview.ui
  (:require
   [reagent.dom.client :as rdom.client]
   [reagent.core :as r]))

(defn output-element
  [element-data]
  (merge element-data
         {:output-element/id (random-uuid)}))

(defonce output-elements
  (r/atom [(output-element {:output-element/type :output-element.type/eval-result
                            :output-element/content "{:a 1}"})
           (output-element {:output-element/type :output-element.type/stdout
                            :output-element/content "Hello world"})]))

(defn add-output-element
  [element]
  (swap! output-elements conj element))

(defn add-eval-result
  [content]
  (add-output-element (output-element {:output-element/type :output-element.type/eval-result
                                       :output-element/content content})))

(defn add-stdout
  [content]
  (add-output-element (output-element {:output-element/type :output-element.type/stdout
                                       :output-element/content content})))

(defn repl-output []
  (let [elements @output-elements]
    [:div
     (for [{:output-element/keys [content id]} elements]
       [:p {:key id} content])]))

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
  (rdom.client/render (rdom.client/create-root (js/document.getElementById "output")) [repl-output]))

(comment
  (set! *print-namespace-maps* false)

  (binding [*print-namespace-maps* false]
    @output-elements)

  (println {:user/a 1, :user/b 2})

  (reset! output-elements [])

  (print)

  @output-elements

  ;; For some reason this is not causing the UI to update...
  ;; Reason: It was because I was connected to the calva-lib (node) build and not the repl-output-ui (browser) build
  (swap! output-elements conj {:output-element/type :output-element.type/eval-result
                               :output-element/content "{:a 1}"})

  :rcf)
